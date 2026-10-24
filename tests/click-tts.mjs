import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = new URL('../', import.meta.url);
const source = file => readFileSync(new URL(file, root), 'utf8');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

// Use the shipped game event handlers. Audio and clocks are the external systems
// mocked here; reading, selection, scoring and route cleanup remain production code.
async function harness(files = [], options = {}) {
  const errors = [], audios = [], timers = new Map(), answers = [];
  let nextTimer = 0, synthesisCalls = 0;
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(`<!doctype html><body>
    <button id="soundBtn" type="button">音效</button>
    <section id="view-home"></section><section id="view-game" class="hidden"><div id="stage"></div></section>
    <div id="modal" class="hidden"><div class="modal-box"><h3 id="modalTitle"></h3>
    <div id="modalBody"></div><div id="modalActions"></div></div></div>
  </body>`, { url: options.url || 'http://127.0.0.1:8022/particles.html#/', runScripts: 'outside-only',
    pretendToBeVisual: true, virtualConsole });
  const { window } = dom, { document } = window;
  await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  window.scrollTo = () => {};
  window.fetch = async () => { throw new Error('TTS must use an audio URL, not fetch'); };
  window.speechSynthesis = { speak() { synthesisCalls++; }, cancel() {}, getVoices() { return []; } };
  window.SpeechSynthesisUtterance = function () {};
  window.setTimeout = (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay, interval: false }); return id; };
  window.setInterval = (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay, interval: true }); return id; };
  window.clearTimeout = window.clearInterval = id => timers.delete(id);
  class MockAudio extends window.EventTarget {
    constructor(url) { super(); this.src = url || ''; this.paused = true; this.playCalls = 0; this.pauseCalls = 0; audios.push(this); }
    play() { this.playCalls++; this.paused = false; return this.rejection ? Promise.reject(this.rejection) : Promise.resolve(); }
    pause() { this.pauseCalls++; this.paused = true; }
    load() {}
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    emit(type) { this.dispatchEvent(new window.Event(type)); if (typeof this[`on${type}`] === 'function') this[`on${type}`](new window.Event(type)); }
  }
  window.Audio = MockAudio;
  const load = file => window.eval(source(`js/${file}`) + `\n//# sourceURL=js/${file}`);
  load('core.js'); load('google-tts.js');
  const J = window.JPQ;
  Object.assign(J.hud, { set() {}, progress() {}, pills() {}, clearPills() {} });
  J.sfx = { on: true, click() {}, correct() {}, wrong() {}, match() {}, levelup() {}, tick() {} };
  J.fx = { center() {}, burst() {} };
  J.stats.answer = (...args) => answers.push(args);
  J.stats.run = () => {};
  document.querySelector('#soundBtn').addEventListener('click', () => { J.sfx.on = !J.sfx.on; });
  files.forEach(load);
  return { window, document, J, audios, timers, answers, errors,
    stage: document.querySelector('#stage'),
    query: selector => document.querySelector(selector),
    route(hash) {
      dom.reconfigure({ url: new URL(hash, window.location.href).href });
      window.dispatchEvent(new window.HashChangeEvent('hashchange')); J.router();
    },
    tick() { [...timers].filter(([, item]) => item.interval).forEach(([id, item]) => { if (timers.has(id)) item.fn(); }); },
    later() { [...timers].filter(([, item]) => !item.interval).forEach(([id, item]) => { if (timers.delete(id)) item.fn(); }); },
    synthesisCalls: () => synthesisCalls,
    close() { J.tts.stop(); dom.window.close(); }
  };
}

const spoken = h => {
  assert.ok(h.audios.length, 'A user click must start Google audio');
  const url = new URL(h.audios.at(-1).src, h.window.location.href);
  assert.equal(url.pathname, '/api/tts', 'Media must use our audio proxy so Google browser media restrictions cannot return HTML');
  assert.ok(['127.0.0.1', 'localhost', 'nihongo-2.onrender.com'].includes(url.hostname));
  return { text: url.searchParams.get('text'), lang: url.searchParams.get('lang'), url };
};
const playButton = h => h.query('#stage [data-tts-text]');

test('shipped particle and verb pages load the Google reader after the shared core', () => {
  ['particles.html', 'conjugation.html'].forEach(file => {
    const html = source(file);
    const scripts = [...html.matchAll(/<script\s+src="([^"?]+)(?:\?[^\"]*)?"/g)].map(match => match[1]);
    assert.ok(scripts.includes('js/google-tts.js'), `${file} needs the public Google reader`);
    assert.ok(scripts.indexOf('js/google-tts.js') > scripts.indexOf('js/core.js'));
  });
});

test('Google audio starts on click, uses Japanese readings and preserves the existing speech helper', async () => {
  const h = await harness();
  try {
    const speech = h.J.speech;
    assert.equal(h.audios.length, 0, 'Loading the page must not autoplay');
    h.stage.innerHTML = h.J.tts.control('私[わたし]は　学校[がっこう]__　行[い]きます。');
    h.J.tts.bind(h.stage);
    assert.equal(h.audios.length, 0, 'Rendering and binding a question must not autoplay');
    playButton(h).click();
    const audio = spoken(h);
    assert.equal(audio.lang, 'ja');
    assert.equal(audio.text, 'ワタシはガッコウ、イきます。', 'Read the supplied furigana without changing the surrounding particles');
    assert.ok(!/[\[\]_]/.test(audio.text), 'Ruby syntax and blanks cannot be read literally');
    assert.equal(h.J.speech, speech);
    assert.equal(h.synthesisCalls(), 0, 'Google playback cannot silently fall back to Web Speech');
    h.audios.at(-1).emit('playing');
    assert.equal(h.query('#ttsStatus').dataset.state, 'playing');
    assert.ok(playButton(h).classList.contains('is-speaking'));
    h.audios.at(-1).emit('ended'); await flush();
    assert.ok(!playButton(h).classList.contains('is-speaking'));
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('static hosting and GitHub Pages use the deployed audio API while local testing stays same-origin', async () => {
  for (const origin of ['https://nihongo-2-static.onrender.com', 'https://abc6024.github.io', 'http://localhost:8000']) {
    const h = await harness([], { url: origin + '/conjugation.html#/' });
    try {
      h.J.tts.say('よみます');
      assert.equal(spoken(h).url.origin, origin.startsWith('http://localhost') ? origin : 'https://nihongo-2.onrender.com');
      assert.equal(spoken(h).text, 'よみます');
    } finally { h.close(); }
  }
});

test('standalone particle pronunciation changes only when explicitly requested', async () => {
  const h = await harness();
  try {
    [['は', 'わ'], ['へ', 'え'], ['を', 'お']].forEach(([text, expected]) => {
      h.J.tts.say(text, { particle: true }); assert.equal(spoken(h).text, expected);
    });
    h.J.tts.say('はなします');
    assert.equal(spoken(h).text, 'はなします', 'The beginning of a normal word is not a particle');
    h.J.tts.say('母[はは]'); assert.equal(spoken(h).text, 'ハハ');
  } finally { h.close(); }
});

test('the shipped nose question keeps lexical ハ distinct from particles without revealing the blank', async () => {
  const h = await harness(['data.js', 'quiz.js']);
  try {
    const q = h.J.LEVELS.flatMap(level => level.qs).find(item => item.q.includes('鼻[はな]'));
    assert.ok(q, 'Exercise the actual question reported by the learner');
    h.J.LEVELS = [{ no: 1, title: '發音回歸', sub: '', qs: [q] }];
    h.route('#/play/quiz'); h.query('[data-lv="1"]').click();
    playButton(h).click();
    assert.equal(spoken(h).text, 'ゾウ、ハナがナガいです。');
    assert.equal(h.answers.length, 0, 'Listening to the question must not submit an answer');
    h.query('.opt[data-o="は"]').click();
    assert.equal(spoken(h).text, 'わ', 'The standalone topic particle still needs wa');
    h.query('#fb [data-tts-text]').click();
    assert.equal(spoken(h).text, 'ゾウはハナがナガいです。', 'Only post-answer playback may fill the blank');
    h.J.tts.say('鼻[はな]', { particle: true });
    assert.equal(spoken(h).text, 'ハナ', 'A noun cannot be mistaken for a standalone particle');
    h.J.tts.say('弾[ひ]けます');
    assert.equal(spoken(h).text, 'ヒけます', 'Keep the explicit reading of ambiguous kanji');
    h.J.tts.say('話[はな]します');
    assert.equal(spoken(h).text, 'ハナします', 'Respect the displayed reading without changing lexical ハ into wa');
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('particle prompts, feedback, reference examples and matching contain no time expressions', async () => {
  const h = await harness(['data.js']);
  try {
    const catalog = JSON.stringify([h.J.PARTICLES, h.J.LEVELS, h.J.SPEED_EXTRA, h.J.SCRAMBLE, h.J.MATCH]);
    assert.doesNotMatch(catalog, /毎[日朝晩週月年]|今日|昨日|明日|来年|週末|[月火水木金土日]曜日|(?:[一二三四五六七八九十0-9]+|何)時|朝\[|今\[|あした|休\[やす\]みの日|每天|早上|明天|昨天|今天|星期|週末|假日|明年|幾點|特定時間/);
    assert.deepEqual(Array.from(h.J.LEVELS, level => level.qs.length), [8, 9, 9, 10, 6, 8]);
    assert.equal(h.J.SCRAMBLE.length, 24, 'Rewriting time-based questions must preserve the existing round length');
    assert.ok(h.J.MATCH[1].pairs.some(p => p.t.includes('上手[じょうず]です。')));
    assert.ok(!catalog.includes('上手[じょうず]い'), 'じょうず is a na-adjective, not じょうずい');
    assert.ok(!catalog.includes('お茶[おちゃ]'), 'The kana お is already outside the annotated kanji');
  } finally { h.close(); }
});

test('the bread question displays and reads the same sentence without a time modifier', async () => {
  const h = await harness(['data.js', 'quiz.js']);
  try {
    const q = h.J.LEVELS[1].qs.find(item => item.q.startsWith('パン__') && item.q.includes('食[た]べます'));
    assert.ok(q, 'Keep the learner-reported bread exercise');
    h.J.LEVELS = [{ no: 1, title: '朗讀回歸', sub: '', qs: [q] }];
    h.route('#/play/quiz'); h.query('[data-lv="1"]').click();
    assert.equal(playButton(h).dataset.ttsText, q.q);
    assert.equal(h.query('.q-zh').textContent, '我吃麵包。');
    playButton(h).click(); assert.equal(spoken(h).text, 'パン、タべます。');
    h.query('.opt[data-o="を"]').click();
    h.query('#fb [data-tts-text]').click();
    assert.equal(spoken(h).text, 'パンをタべます。');
    assert.deepEqual(h.answers, [['を', true]]);
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('furigana overrides kanji in every sentence while particles and Chinese remain intact', async () => {
  const h = await harness();
  try {
    const cases = [
      ['単語[たんご]__　勉強[べんきょう]します。', 'タンゴ、ベンキョウします。'],
      ['かばんの　中[なか]におかしが入[はい]っています。', 'かばんのナカにおかしがハイっています。'],
      ['箱[はこ]の中[なか]に猫[ねこ]がいます。', 'ハコのナカにネコがいます。'],
      ['母[はは]は日本語[にほんご]で話[はな]します。', 'ハハはニホンゴでハナします。'],
      ['切[き]る', 'キる'], ['着[き]る', 'キる'],
      ['降[ふ]ります', 'フります'], ['降[お]ります', 'オります'],
      ['雨[あめ]が降[ふ]ります。', 'アメがフります。'],
      ['弾[ひ]けます', 'ヒけます'],
      ['ピアノが弾[ひ]けます。', 'ピアノがヒけます。'],
      ['これは何[なん]ですか。', 'これはナンですか。'],
      ['何[なに]を見[み]ますか。', 'ナニをミますか。'],
      ['友達[ともだち]　　　映画[えいが]を見[み]る。', 'トモダチ、エイガをミる。']
    ];
    for (const [raw, expected] of cases) {
      h.J.tts.say(raw); assert.equal(spoken(h).text, expected);
    }
    h.J.tts.say('生[う]まれらない', { reading: 'kana' });
    assert.equal(spoken(h).text, 'うまれらない', 'A deliberately incorrect choice must retain its supplied reading');
    h.stage.innerHTML = h.J.tts.control('生[う]まれらない', '聽所選內容', { reading: 'kana' });
    h.J.tts.bind(h.stage); playButton(h).click();
    assert.equal(spoken(h).text, 'うまれらない', 'Replay controls must retain an explicit reading mode');
    h.J.tts.say('表示「A 的 B」或性質', { lang: 'zh-TW' });
    assert.equal(spoken(h).text, '表示「A 的 B」或性質');
    assert.equal(spoken(h).lang, 'zh-TW');
  } finally { h.close(); }
});

test('newest click cancels previous playback and stale errors cannot replay an old request', async () => {
  const h = await harness();
  try {
    const first = h.J.tts.say('かきます'); const old = h.audios.at(-1);
    const second = h.J.tts.say('よみます');
    assert.ok(old.pauseCalls > 0);
    const count = h.audios.length;
    old.emit('error'); old.emit('ended'); old.emit('playing'); await flush();
    assert.equal(h.audios.length, count, 'Cancelled requests must not trigger endpoint fallback');
    assert.equal(spoken(h).text, 'よみます');
    assert.equal(await first, false);
    h.audios.at(-1).emit('ended');
    await second;
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('route changes, page exit, hidden documents and the sound switch stop playback', async () => {
  const h = await harness();
  try {
    for (const event of ['hashchange', 'pagehide']) {
      const result = h.J.tts.say('ききます'); const audio = h.audios.at(-1);
      h.window.dispatchEvent(new h.window.Event(event));
      assert.ok(audio.pauseCalls > 0, event); assert.equal(await result, false);
    }
    const hidden = h.J.tts.say('みます'); const hiddenAudio = h.audios.at(-1);
    Object.defineProperty(h.document, 'hidden', { configurable: true, value: true });
    h.document.dispatchEvent(new h.window.Event('visibilitychange'));
    assert.ok(hiddenAudio.pauseCalls > 0); assert.equal(await hidden, false);
    Object.defineProperty(h.document, 'hidden', { configurable: true, value: false });
    const muted = h.J.tts.say('おきます'); const muteAudio = h.audios.at(-1);
    h.query('#soundBtn').click(); assert.ok(muteAudio.pauseCalls > 0); assert.equal(await muted, false);
    const count = h.audios.length;
    assert.equal(await h.J.tts.say('ねます'), false);
    assert.equal(h.audios.length, count, 'Muted clicks may not create audio or start requests');
    assert.equal(h.query('#ttsStatus').dataset.state, 'muted');
  } finally { h.close(); }
});

test('an API audio error reports a recoverable failure and retries only on another user click', async () => {
  const h = await harness();
  try {
    const result = h.J.tts.say('たべます'); const first = h.audios.at(-1);
    first.emit('error'); await flush();
    assert.equal(await result, false);
    assert.equal(h.audios.length, 1, 'The API handles upstream fallback; the browser must not retry media requests automatically');
    assert.equal(h.query('#ttsStatus').dataset.state, 'error');
    assert.ok(h.query('#ttsStatus').textContent.trim(), 'Failure feedback must be visible');
    assert.equal(h.synthesisCalls(), 0);
    const retry = h.J.tts.say('たべます'); assert.equal(h.audios.length, 2);
    h.audios.at(-1).emit('ended'); await retry;
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('play promise rejection and synchronous audio failure cannot interrupt a game click', async () => {
  const h = await harness();
  try {
    const Base = h.window.Audio;
    h.window.Audio = class extends Base {
      constructor(url) { super(url); this.rejection = new h.window.DOMException('Click required', 'NotAllowedError'); }
    };
    assert.equal(await h.J.tts.say('あそびます'), false);
    assert.equal(h.query('#ttsStatus').dataset.state, 'error');
    h.window.Audio = class { constructor() { throw new Error('Audio unavailable'); } };
    assert.equal(await h.J.tts.say('はたらきます'), false);
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('particle quiz reads only the visible blank prompt and the selected option without extra scoring', async () => {
  const h = await harness(['data.js', 'quiz.js']);
  try {
    const q = { q: '先生[せんせい]__　手紙[てがみ]を　書[か]きます。', a: 'に', opts: ['に', 'で', 'は', 'を'], zh: '寫信給老師。' };
    h.J.LEVELS = [{ no: 1, title: '測試', sub: '練習', qs: [q] }];
    h.route('#/play/quiz'); h.query('[data-lv="1"]').click();
    assert.equal(h.audios.length, 0);
    playButton(h).click(); const text = spoken(h).text;
    assert.equal(text, 'センセイ、テガミをカきます。');
    assert.ok(!text.includes('センセイに'), 'Question playback must not fill the correct particle');
    assert.equal(h.answers.length, 0, 'Replay is not an answer');
    h.query('.opt[data-o="は"]').click();
    assert.equal(spoken(h).text, 'わ');
    assert.deepEqual(h.answers, [['に', false]]);
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('speed voice does not add a timer or wait for audio before counting time and answers', async () => {
  const h = await harness(['data.js', 'speed.js']);
  try {
    h.route('#/play/speed'); h.query('#startBtn').click();
    assert.equal(h.audios.length, 0);
    const intervals = () => [...h.timers.values()].filter(item => item.interval).length;
    assert.equal(intervals(), 1);
    playButton(h).click(); assert.equal(intervals(), 1);
    h.tick();
    h.query('.opt').click();
    assert.equal(h.answers.length, 1, 'An unfinished audio request cannot postpone scoring');
    assert.equal(intervals(), 1);
    h.route('#/'); assert.equal(intervals(), 0);
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('scramble reads the clicked token without revealing the complete answer', async () => {
  const h = await harness(['data.js', 'scramble.js']);
  try {
    h.route('#/play/scramble'); h.query('#startBtn').click();
    assert.equal(h.audios.length, 0);
    h.query('#pool [data-pool="2"]').click();
    assert.equal(spoken(h).text, 'ヒけます');
    assert.equal(h.query('#slot').querySelectorAll('[data-pool]').length, 1);
    assert.equal(h.answers.length, 0);
    assert.ok(!spoken(h).text.includes('ピアノ'));
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('matching reads visible right-hand descriptions and blank sentences without their hidden particle key', async () => {
  const h = await harness(['data.js', 'match.js']);
  try {
    h.route('#/play/match'); h.query('#startBtn').click();
    assert.equal(h.audios.length, 0);
    const first = h.J.MATCH[0].pairs[0];
    h.query(`.mtile[data-side="R"][data-k="${first.k}"]`).click();
    assert.equal(spoken(h).lang, 'zh-TW');
    assert.equal(spoken(h).text, h.J.tts.reading(first.t));
    h.J.MATCH[0].pairs.forEach(p => {
      h.query(`.mtile[data-side="L"][data-k="${p.k}"]`).click();
      h.query(`.mtile[data-side="R"][data-k="${p.k}"]`).click();
    });
    h.query('#modalActions button').click();
    const p = h.J.MATCH[1].pairs.find(item => item.k === 'は');
    const right = h.query('.mtile[data-side="R"][data-k="は"]');
    assert.ok(right); right.click();
    assert.equal(spoken(h).lang, 'ja');
    assert.equal(spoken(h).text, h.J.tts.reading(p.t));
    assert.ok(!spoken(h).text.includes('それは'), 'Do not fill a hidden answer while reading a blank sentence');
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('all 24 scramble sentences follow their rendered furigana in tokens, arrangements and full replay', async () => {
  const h = await harness(['data.js', 'scramble.js']);
  const displayedReading = button => {
    const copy = button.cloneNode(true);
    copy.querySelectorAll('ruby').forEach(ruby => {
      const kana = ruby.querySelector('rt').textContent.replace(/[ぁ-ゖ]/g,
        char => String.fromCharCode(char.charCodeAt(0) + 0x60));
      ruby.replaceWith(h.document.createTextNode(kana));
    });
    return copy.textContent.replace(/\s+/g, '');
  };
  try {
    h.route('#/play/scramble'); h.query('#startBtn').click();
    for (let n = 0; n < h.J.SCRAMBLE.length; n++) {
      const q = h.J.SCRAMBLE[n];
      const expected = q.ans.map((_, i) => displayedReading(h.query(`#pool [data-pool="${i}"]`)));
      q.ans.forEach((_, i) => {
        h.query(`#pool [data-pool="${i}"]`).click();
        assert.equal(spoken(h).text, expected[i], `Token ${i + 1} in sentence ${n + 1}`);
        h.query('#sentenceAudio [data-tts-text]').click();
        assert.equal(spoken(h).text, expected.slice(0, i + 1).join(''), 'Read only what has been placed');
      });
      if (n === 0) assert.equal(expected.join(''), 'ワタシはピアノがヒけます', '弾[ひ] must stay hi within the whole sentence');
      h.query('#checkBtn').click();
      const count = h.answers.length;
      h.query('.fb [data-tts-text]').click();
      assert.equal(spoken(h).text, expected.join(''), `Full replay in sentence ${n + 1}`);
      assert.equal(h.answers.length, count, 'Listening again cannot submit an answer');
      if (n < h.J.SCRAMBLE.length - 1) h.query('#nextBtn').click();
    }
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('reviewed alternate scramble orders score once and replay the sentence the player arranged', async () => {
  const h = await harness(['data.js', 'scramble.js']);
  try {
    const cases = Array.from(h.J.SCRAMBLE).flatMap(q => Array.from(q.altOrders || [], order => ({ q, order })));
    assert.ok(cases.length > 0);
    h.J.SCRAMBLE = cases.map(({ q }) => q);
    h.route('#/play/scramble'); h.query('#startBtn').click();
    for (const [n, { q, order }] of cases.entries()) {
      assert.deepEqual(Array.from(order).sort((a, b) => a - b), Array.from(q.ans, (_, i) => i), 'An alternative must use every token exactly once');
      order.forEach(i => h.query(`#pool [data-pool="${i}"]`).click());
      h.query('#checkBtn').click();
      assert.ok(h.query('.fb.ok'), `Accept ${q.zh}: ${order}`);
      assert.equal(h.query('.fb.no'), null);
      const count = h.answers.length;
      h.query('#checkBtn').click();
      assert.equal(h.answers.length, count, 'An alternate answer cannot score twice');
      assert.deepEqual(h.answers.slice(-q.particles.length), Array.from(q.particles, p => [p, true]));
      h.query('.fb [data-tts-text]').click();
      assert.equal(spoken(h).text, h.J.tts.reading(order.map(i => q.ans[i]).join('')), 'Replay the accepted order, including its furigana');
      if (n < cases.length - 1) h.query('#nextBtn').click();
    }
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('scramble hints complete a valid alternate prefix and do not append to an invalid prefix', async () => {
  const h = await harness(['data.js', 'scramble.js']);
  try {
    const train = h.J.SCRAMBLE[1];
    h.J.SCRAMBLE = [train];
    h.route('#/play/scramble'); h.query('#startBtn').click();
    h.query('#pool [data-pool="1"]').click();
    h.query('#hintBtn').click();
    assert.deepEqual([...h.query('#slot').querySelectorAll('[data-pool]')].map(b => b.dataset.pool), ['1', '0']);
    h.query('#pool [data-pool="2"]').click(); h.query('#checkBtn').click();
    assert.ok(h.query('.fb.ok'), '駅に電車が着きます must also be accepted');

    h.route('#/'); h.route('#/play/scramble'); h.query('#startBtn').click();
    h.query('#pool [data-pool="2"]').click(); h.query('#hintBtn').click();
    assert.equal(h.query('#slot').querySelectorAll('[data-pool]').length, 1, 'An invalid prefix must not get a misleading token');
    assert.match(h.query('#hintBtn').textContent, /先調整/);
    assert.equal(h.query('#hintBtn').disabled, false, 'Adjusting the arrangement must leave the hint available');
    h.query('#slot [data-pool="2"]').click();
    h.query('#hintBtn').click();
    assert.equal(h.query('#slot [data-pool]').dataset.pool, '0');
  } finally { h.close(); }
});

test('scramble rejects a misplaced predicate or a separated adjective and noun', async () => {
  const h = await harness(['data.js', 'scramble.js']);
  try {
    const cases = [
      { q: h.J.SCRAMBLE[1], order: [2, 0, 1] },
      { q: h.J.SCRAMBLE[6], order: [1, 0, 2, 3] }
    ];
    for (const { q, order } of cases) {
      h.J.SCRAMBLE = [q];
      h.route('#/'); h.route('#/play/scramble'); h.query('#startBtn').click();
      order.forEach(i => h.query(`#pool [data-pool="${i}"]`).click());
      h.query('#checkBtn').click();
      assert.ok(h.query('.fb.no'));
      assert.equal(h.query('#nextBtn'), null, 'Wrong orders cannot advance or award a correct answer');
      assert.deepEqual(h.answers.slice(-q.particles.length), Array.from(q.particles, p => [p, false]));
    }
  } finally { h.close(); }
});

test('all 660 textbook verb forms preserve the displayed kana rather than asking Google to read kanji', async () => {
  const h = await harness(['verb-data.js', 'verb-vocab.js']);
  const hiragana = text => text.replace(/[ァ-ヶ]/g,
    char => String.fromCharCode(char.charCodeAt(0) - 0x60));
  try {
    for (const verb of h.J.verbVocab.VERBS) for (const key of ['base', 'masu', 'te', 'nai', 'ta']) {
      const text = h.J.tts.reading(h.J.verb.display(verb, key));
      assert.doesNotMatch(text, /[一-龯]/, `${verb.id}/${key} cannot leave a kanji reading for Google to guess`);
      assert.equal(hiragana(text), hiragana(h.J.verb.conjugate(verb, key)), `${verb.id}/${key}`);
    }
  } finally { h.close(); }
});

test('verb question reads its presented source form, selected options read themselves and score once', async () => {
  const h = await harness(['verb-data.js', 'verb-vocab.js', 'verb-beginner.js', 'verb-levels.js', 'verb-quiz.js']);
  try {
    const build = h.J.verbGame.build;
    let round;
    h.J.verbGame.build = config => { round = build(config); return round; };
    h.route('#/play/verb-quiz/nai/all');
    assert.equal(h.audios.length, 0);
    const q = round[0]; const expectedSource = h.J.tts.reading(q.from);
    assert.notEqual(h.J.verb.conjugate(q.verb, q.fromKey), q.a);
    const word = h.query('.vb-word [data-tts-text]'); assert.ok(word); word.click();
    assert.equal(word.dataset.ttsText, q.from, 'The prompt must preserve its displayed verb identity, including kanji');
    assert.equal(spoken(h).lang, 'ja');
    assert.equal(spoken(h).text, expectedSource, 'The prompt must read its visible source form, not the target answer');
    assert.equal(h.answers.length, 0);
    const wrong = [...h.stage.querySelectorAll('.opt')].find(btn => btn.dataset.o !== q.a);
    const pick = wrong.dataset.o; wrong.click();
    assert.equal(spoken(h).text, pick);
    assert.deepEqual(h.answers, [['形:nai', false]]);
    wrong.click(); assert.equal(h.answers.length, 1);
    const replay = h.query('#fb [data-tts-text]');
    assert.equal(replay.dataset.ttsText, h.J.verb.displayKana(q.verb, q.a));
    replay.click(); assert.equal(spoken(h).text, h.J.tts.reading(h.J.verb.displayKana(q.verb, q.a)));
    h.query('#nextBtn').click();
    assert.equal(h.audios.at(-1).paused, true, 'Advancing questions must stop the previous voice');
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});
