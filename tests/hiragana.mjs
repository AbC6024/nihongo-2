import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const gameRoot = new URL('../', import.meta.url);
const html = readFileSync(new URL('gojuon.html', gameRoot), 'utf8');
const scripts = ['js/core.js', 'js/catalog.js', 'js/site.js', 'js/kana-data.js', 'js/vocab-data.js', 'js/gojuon.js',
  'hiragana/js/utils.js', 'hiragana/js/data.js', 'hiragana/js/memory.js', 'hiragana/js/sentence.js', 'js/kana-extra.js', 'js/home.js'];
const existingProgress = {
  'jpq.progress.v1': '{"levels":{"1":3,"verb-study-v2-1":2},"records":{"kana-read-best":80}}',
  'jpq.nick.speed': 'Existing player',
  'niiki.settings': '{"voiceRate":0.8}',
  'niiki.attempts': '[{"id":"existing-listening-attempt","correct":true}]',
  'niiki.daily': '{"completed":["2026-10-18"]}'
};

// Use the shipped page and every shipped game script. Only browser services and
// the clock are replaced; clicks and hash changes run the actual event handlers.
function harness(random = 0.99) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, {
    url: 'https://nihongo.test/gojuon.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole
  });
  const { window } = dom;
  const { document } = window;
  const timers = new Map();
  const spoken = [];
  const utterances = [];
  let nextTimer = 0;
  let now = 1_000_000;
  const schedule = (fn, ms, interval, args) => {
    const id = ++nextTimer;
    timers.set(id, { fn, due: now + Math.max(1, Number(ms) || 0), interval, args });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => schedule(fn, ms, 0, args);
  window.setInterval = (fn, ms, ...args) => schedule(fn, ms, Math.max(1, Number(ms) || 0), args);
  window.clearTimeout = window.clearInterval = id => timers.delete(id);
  window.requestAnimationFrame = fn => window.setTimeout(() => fn(now), 16);
  window.cancelAnimationFrame = window.clearTimeout;
  window.Date.now = () => now;
  window.Math.random = () => random;
  window.scrollTo = () => {};
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  window.speechSynthesis = {
    getVoices: () => [{ lang: 'ja-JP' }],
    addEventListener() {},
    cancel() {},
    speak: utterance => { spoken.push(utterance.text); utterances.push(utterance); }
  };
  window.HTMLCanvasElement.prototype.getContext = () => null;
  Object.entries(existingProgress).forEach(([key, value]) => window.localStorage.setItem(key, value));
  scripts.forEach(name => window.eval(readFileSync(new URL(name, gameRoot), 'utf8') + '\n//# sourceURL=' + name));
  window.JPQ.store.load();
  window.JPQ.hud.init();
  window.JPQ.sfx = { click() {}, correct() {}, wrong() {}, levelup() {} };
  window.JPQ.site.mountChrome('gojuon');
  window.JPQ.home.render();

  const query = selector => document.querySelector(selector);
  const all = selector => Array.from(document.querySelectorAll(selector));
  function advance(ms) {
    const target = now + ms;
    let guard = 0;
    while (true) {
      const next = [...timers].filter(([, item]) => item.due <= target)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      assert.ok(++guard < 20_000, 'Timer callbacks must not loop indefinitely');
      const [id, timer] = next;
      now = timer.due;
      if (timer.interval) timer.due += timer.interval;
      else timers.delete(id);
      timer.fn.apply(window, timer.args);
    }
    now = target;
  }
  function route(key = '', pool = 'hiragana') {
    dom.reconfigure({ url: `https://nihongo.test/gojuon.html#/${key ? 'play/kana-' + key + (pool ? '/' + pool : '') : ''}` });
    window.JPQ.router();
  }
  function button(text, selector = 'button') {
    const result = all(selector).find(node => node.textContent.includes(text));
    assert.ok(result, `Expected button containing ${text}`);
    return result;
  }
  function preserveProgress() {
    Object.entries(existingProgress).forEach(([key, value]) => {
      assert.equal(window.localStorage.getItem(key), value, `Must preserve ${key}`);
    });
  }
  function clean() {
    route();
    advance(10_000);
    assert.equal(query('.modal-backdrop'), null, 'Leaving a mode must prevent delayed modals');
    assert.equal([...timers.values()].filter(item => item.interval).length, 0, 'Leaving a mode must stop its timers');
    assert.deepEqual(errors, [], 'The real game scripts must not raise browser errors');
    preserveProgress();
  }
  return {
    window, document, query, all, advance, route, button, spoken, utterances, timers, errors,
    preserveProgress, clean, close: () => dom.window.close()
  };
}

function check(h) {
  return h.query('.q-actions button');
}

function question(h) {
  const zh = h.query('.q-zh').textContent;
  const item = h.window.KanaData.SENTENCES.find(candidate => candidate.zh === zh);
  assert.ok(item, 'The rendered question must belong to the imported question bank');
  const kanaMode = !h.query('.sentence').classList.contains('sentence--word');
  return { item, kanaMode, answers: kanaMode ? item.syll : item.romaji };
}

function fillSentence(h, answers) {
  h.all('.slot:not(.slot--given)').forEach(slot => {
    if (slot.textContent) slot.click();
    slot.click();
    const answer = answers[Number(slot.dataset.i)];
    const token = h.all('.token').find(node => node.textContent === answer);
    assert.ok(token, `The word bank must contain the required answer ${answer}`);
    token.click();
    assert.equal(slot.textContent, answer);
  });
}

function memoryCards(h) {
  return h.all('.memory-board .mcard').map(button => {
    const face = button.querySelector('.mcard__front');
    return {
      button,
      value: face.textContent,
      bonus: face.classList.contains('mcard__front--bonus'),
      romaji: face.classList.contains('mcard__front--romaji')
    };
  });
}

function solveMemory(h) {
  const cards = memoryCards(h);
  cards.filter(card => !card.bonus && !card.romaji).forEach(kana => {
    const romaji = cards.find(card => card.romaji && card.value === h.window.KanaData.romajiOf(kana.value));
    kana.button.click();
    romaji.button.click();
    h.advance(620);
    assert.ok(kana.button.classList.contains('is-done'));
    assert.ok(romaji.button.classList.contains('is-done'));
  });
}

test('merged kana portal orders six categories and offers hiragana before katakana without duplicate matching', () => {
  const h = harness();
  try {
    assert.deepEqual(Array.from(h.window.JPQ.CATALOG, game => game.title), ['五十音', '助詞', '片假名單字', '聽打', '動詞', '閱讀']);
    assert.deepEqual(h.all('.site-menu a').slice(1, -1).map(a => a.textContent), ['五十音', '助詞', '片假名單字', '聽打', '動詞', '閱讀']);
    assert.deepEqual(h.all('.kana-path').map(section => section.dataset.script), ['hiragana', 'katakana']);
    assert.equal(h.all('.kana-path[data-script="hiragana"] .pane').length, 6);
    assert.equal(h.all('.kana-path[data-script="katakana"] .pane').length, 4);
    assert.equal(h.query('a[href*="/matching"]'), null);
    assert.ok(!h.query('#gameGrid').textContent.includes('連連看'));
    assert.equal(h.query('script[src*="matching.js"]'), null);
    h.route('read', '');
    assert.equal(h.query('[data-pool].on').dataset.pool, 'hiragana');
    assert.deepEqual(h.all('[data-pool]').map(button => button.dataset.pool), ['hiragana', 'katakana', 'vocabulary']);
    h.route('read', 'katakana');
    assert.equal(h.query('[data-pool].on').dataset.pool, 'katakana');
    assert.match(h.query('.kana-big').textContent, /^[\u30a0-\u30ff]+$/u);
    h.route('match', 'hiragana');
    assert.equal(h.query('[data-pool].on').dataset.pool, 'hiragana');
    h.clean();
  } finally { h.close(); }
});

test('old adventure bookmarks lead to the merged modes and preserve other progress', () => {
  const source = readFileSync(new URL('hiragana/js/app.js', gameRoot), 'utf8');
  for (const [hash, expected] of [['', '#/'], ['#/memory', '#/play/kana-memory/hiragana'], ['#/sentence', '#/play/kana-sentence/hiragana'], ['#/matching', '#/play/kana-match/hiragana']]) {
    let target;
    const run = new Function('location', source);
    run({ hash, replace(url) { target = url; } });
    assert.equal(target, '../gojuon.html' + expected);
  }
});

test('hiragana data covers all 46 basic kana without ambiguous matching pairs', () => {
  const h = harness();
  try {
    const D = h.window.KanaData;
    assert.equal(D.BASIC_POOL.length, 46);
    assert.equal(new Set(D.BASIC_POOL.map(item => item.k)).size, 46);
    assert.equal(new Set(D.BASIC_POOL.map(item => item.r)).size, 46);
    assert.deepEqual(Array.from(D.buildFinalRounds(), round => round.kana.length), [15, 15, 16]);
    const basics = D.MATCHING_STAGES.slice(0, 5).flatMap(stage => D.buildBatches(stage).flat());
    assert.equal(basics.length, 46);
    assert.equal(new Set(basics.map(item => item.k)).size, 46);
    assert.equal(D.kanaEquivalent('し', 'す'), false, 'Different sounds must not pass a sentence answer');
    assert.equal(D.kanaEquivalent('て', 'で'), false, 'Voiced and unvoiced kana must remain distinct');
    assert.equal(D.romajiEquivalent('shi', 'su'), false);
    h.clean();
  } finally { h.close(); }
});

for (const [rows, cols, preview] of [[2, 3, false], [3, 4, true]]) {
  test(`memory ${rows}×${cols} has complete pairs and the updated preview rules`, () => {
    const h = harness();
    try {
      h.route('memory');
      assert.equal(h.all('.size-opt').length, 2);
      h.query(`.size-opt[data-size="${rows}x${cols}"]`).click();
      const pairs = rows * cols / 2;
      const cards = memoryCards(h);
      assert.equal(cards.length, rows * cols);
      assert.equal(cards.filter(card => card.bonus).length, 0);
      assert.equal(cards.filter(card => card.romaji).length, pairs);
      const kana = cards.filter(card => !card.romaji);
      assert.equal(new Set(kana.map(card => card.value)).size, pairs);
      kana.forEach(card => assert.equal(cards.filter(other => other.romaji && other.value === h.window.KanaData.romajiOf(card.value)).length, 1));
      assert.equal(h.query('.memory-board').getAttribute('aria-rowcount'), String(rows));
      assert.equal(h.query('.memory-board').getAttribute('aria-colcount'), String(cols));
      if (preview) {
        assert.ok(cards.every(card => card.button.disabled && card.button.classList.contains('is-preview')));
        h.advance(6999);
        assert.ok(cards.every(card => card.button.disabled));
        h.advance(1);
      }
      assert.ok(cards.every(card => !card.button.disabled && !card.button.classList.contains('is-preview')));
      solveMemory(h);
      h.advance(700);
      assert.match(h.query('.modal__title').textContent, /配對完成/);
      assert.equal(h.all('.mcard.is-done').length, rows * cols);
      h.clean();
    } finally { h.close(); }
  });
}

test('leaving memory before its delayed completion cannot open a modal on another route', () => {
  const h = harness();
  try {
    h.route('memory');
    h.query('.size-opt[data-size="2x3"]').click();
    solveMemory(h);
    assert.equal(h.query('.modal-backdrop'), null);
    h.route('sentence');
    const prompt = h.query('.q-prompt').textContent;
    const spokenBefore = h.spoken.length;
    h.advance(10_000);
    assert.equal(h.query('.modal-backdrop'), null);
    assert.equal(h.query('.q-prompt').textContent, prompt);
    assert.equal(h.spoken.length, spokenBefore, 'Old memory completion must not speak over the sentence mode');
    h.clean();
  } finally { h.close(); }
});

test('memory mismatch stays visible, locks other cards, and cannot settle into a restarted game', () => {
  const h = harness();
  try {
    h.route('memory');
    h.query('.size-opt[data-size="2x3"]').click();
    const cards = memoryCards(h).filter(card => !card.bonus);
    const a = cards.find(card => !card.romaji);
    const b = cards.find(card => card.romaji && card.value !== h.window.KanaData.romajiOf(a.value));
    const third = cards.find(card => card !== a && card !== b);
    a.button.click();
    b.button.click();
    third.button.click();
    assert.equal(h.all('.mcard.is-open').length, 2, 'A third flip must be ignored until the pair settles');
    h.advance(1000);
    assert.ok(a.button.classList.contains('is-open'));
    assert.ok(b.button.classList.contains('is-open'));
    h.advance(300);
    assert.equal(h.all('.mcard.is-open').length, 0, 'Both mismatched cards must turn over together');

    a.button.click();
    const correct = cards.find(card => card.romaji && card.value === h.window.KanaData.romajiOf(a.value));
    correct.button.click();
    h.button('重新開始本局').click();
    h.advance(1300);
    assert.equal(h.all('.mcard.is-done').length, 0, 'An old pair callback must not complete cards in a new game');
    assert.equal(h.all('.hud__value')[0].textContent, '0');
    assert.equal(h.all('.hud__value')[1].textContent, '0 / 3');
    h.clean();
  } finally { h.close(); }
});

for (const [random, expectedKanaMode] of [[0.01, true], [0.99, false]]) {
  test(`sentence ${expectedKanaMode ? 'kana' : 'romaji'} prompts can retry and complete all 20 sampled questions`, () => {
    const h = harness(random);
    try {
      h.route('sentence');
      const seen = [];
      for (let index = 0; index < 20; index++) {
        const { item, kanaMode, answers } = question(h);
        assert.equal(kanaMode, expectedKanaMode);
        assert.equal(item.tier, index < 7 ? 1 : index < 14 ? 2 : 3, 'Difficulty should progress from words to complete sentences');
        seen.push(item.kana);
        assert.ok(h.query('.q-prompt em').textContent);
        check(h).click();
        assert.match(h.query('.result-note').textContent, /先把所有空格填滿/);
        fillSentence(h, answers);
        if (index === 0) {
          const first = h.query('.slot:not(.slot--given)');
          first.click();
          const wrong = h.all('.token').find(node => !answers.includes(node.textContent));
          assert.ok(wrong, 'Each question should offer a distractor');
          wrong.click();
          check(h).click();
          assert.ok(h.query('.slot.is-wrong'), 'A wrong token must be rejected');
          check(h).click();
          assert.equal(h.query('.slot.is-wrong'), null);
          fillSentence(h, answers);
        }
        check(h).click();
        assert.ok(h.query('.result-note--ok'), 'Correct tokens must pass');
        h.advance(3500); // Run both answer speech and any delayed encouragement.
        assert.deepEqual(h.errors, []);
        check(h).click();
      }
      assert.equal(new Set(seen).size, 20);
      assert.match(h.query('.modal__title').textContent, /全部答完/);
      const accuracy = h.all('.modal__stat').find(node => node.querySelector('span').textContent === '一次答對率');
      assert.equal(accuracy.querySelector('b').textContent, '95%', 'The retried question must be excluded from first-try accuracy');
      h.clean();
    } finally { h.close(); }
  });
}

test('leaving a sentence cancels pending answer audio and its automatic advance', () => {
  const h = harness();
  try {
    h.route('sentence');
    fillSentence(h, question(h).answers);
    check(h).click();
    h.route('memory');
    let spokenBefore = h.spoken.length;
    h.advance(10000);
    assert.equal(h.spoken.length, spokenBefore, 'Leaving before playback must cancel the answer audio');
    h.route('sentence');
    fillSentence(h, question(h).answers);
    check(h).click();
    h.advance(320);
    const oldEnd = h.utterances.at(-1).onend;
    h.route('memory');
    spokenBefore = h.spoken.length;
    oldEnd();
    h.advance(10000);
    assert.equal(h.spoken.length, spokenBefore, 'An old audio callback cannot advance or speak on another route');
    assert.equal(h.query('.modal-backdrop'), null);
    h.clean();
  } finally { h.close(); }
});

test('sentence hint after a wrong answer repairs that slot and allows the answer to be checked', () => {
  const h = harness(0.99);
  try {
    h.route('sentence');
    const { answers } = question(h);
    fillSentence(h, answers);
    const slot = h.query('.slot:not(.slot--given)');
    slot.click();
    const wrong = h.all('.token').find(node => !answers.includes(node.textContent));
    assert.ok(wrong);
    wrong.click();
    check(h).click();
    assert.ok(h.query('.slot.is-wrong'));
    h.button('提示 (-30)').click();
    check(h).click();
    assert.ok(h.query('.result-note--ok'), 'Using a hint after failure must leave the question checkable');
    assert.ok(!h.query('.result-note--ok').textContent.includes('一次就全對'), 'An assisted answer must not claim first-try success');
    h.clean();
  } finally { h.close(); }
});

test('dismissing the sentence restart dialog allows it to open again without resetting the game', async () => {
  const h = harness();
  try {
    h.route('sentence');
    const { answers } = question(h);
    fillSentence(h, answers);
    const before = h.query('.sentence').textContent;
    h.button('換一批題目').click();
    assert.equal(h.all('.modal-backdrop').length, 1);
    h.window.document.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    h.advance(100);
    assert.equal(h.query('.modal-backdrop'), null);
    assert.equal(h.query('.sentence').textContent, before);
    h.button('換一批題目').click();
    assert.equal(h.all('.modal-backdrop').length, 1);
    h.clean();
  } finally { h.close(); }
});
