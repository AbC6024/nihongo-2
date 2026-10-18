import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const gameRoot = new URL('../hiragana/', import.meta.url);
const html = readFileSync(new URL('index.html', gameRoot), 'utf8');
const scripts = ['utils', 'data', 'matching', 'memory', 'sentence', 'app'];
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
    url: 'https://nihongo.test/hiragana/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole
  });
  const { window } = dom;
  const { document } = window;
  const timers = new Map();
  const spoken = [];
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
    speak: utterance => spoken.push(utterance.text)
  };
  window.HTMLCanvasElement.prototype.getContext = () => null;
  Object.entries(existingProgress).forEach(([key, value]) => window.localStorage.setItem(key, value));
  scripts.forEach(name => window.eval(readFileSync(new URL(`js/${name}.js`, gameRoot), 'utf8') + `\n//# sourceURL=hiragana/js/${name}.js`));

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
  function route(key = '') {
    dom.reconfigure({ url: `https://nihongo.test/hiragana/#/${key}` });
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
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
    window, document, query, all, advance, route, button, spoken, timers, errors,
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

test('matching plays all five stages, unlocks each next stage, then reviews every basic kana once', () => {
  const h = harness();
  try {
    const D = h.window.KanaData;
    const stageSizes = [10, 10, 10, 8, 8, 46];
    for (let stage = 0; stage < 6; stage++) {
      h.route('matching');
      const options = h.all('.stage-opt');
      assert.equal(options.length, 6);
      assert.equal(options[stage].disabled, false);
      if (stage < 5) assert.equal(options[stage + 1].disabled, true);
      options[stage].click();
      if (stage === 0) {
        const left = h.query('.tile[data-side="left"]');
        left.click();
        h.all('.tile[data-side="right"]').find(node => node.dataset.k !== left.dataset.k).click();
        h.advance(520);
      }
      const played = [];
      let attempts = 0;
      while (!h.query('.modal-backdrop')) {
        assert.ok(++attempts < 120, 'Every matching stage must finish');
        const left = h.query('.tile[data-side="left"]:not(.is-matched)');
        if (!left) { h.advance(1400); continue; }
        const kana = left.dataset.k;
        const right = h.all('.tile[data-side="right"]').find(node => node.dataset.k === kana);
        left.click();
        right.click();
        assert.ok(left.classList.contains('is-matched'), `Pair ${kana} must be accepted`);
        played.push(kana);
        h.advance(620);
        if (stage === 5 && played.length < 42) {
          assert.equal(h.all('.tile[data-side="left"]').length, 5, 'Final review must refill its five-pair window');
        }
      }
      assert.equal(played.length, stageSizes[stage], `Stage ${stage + 1} must exercise each intended pair`);
      assert.equal(new Set(played).size, stageSizes[stage], 'Matched kana must not reappear in the same stage');
      assert.equal(JSON.parse(h.window.localStorage.getItem(D.MATCHING_UNLOCK_KEY)), Math.min(stage + 2, 6));
      if (stage === 0) {
        const mistakes = h.all('.modal__stat').find(node => node.querySelector('span').textContent === '本關失誤');
        assert.equal(mistakes.querySelector('b').textContent, '1 次', 'A first-batch mistake must survive into the whole-stage summary');
      }
      if (stage === 5) {
        assert.deepEqual(played.toSorted(), Array.from(D.BASIC_POOL, item => item.k).toSorted());
        assert.match(h.query('.modal__title').textContent, /全部制霸/);
        assert.equal(h.all('.hud__value')[3].textContent, '0');
      }
    }
    h.clean();
    h.route('matching');
    assert.ok(h.all('.stage-opt').every(option => !option.disabled), 'Unlock progress survives remounting');
    h.clean();
  } finally { h.close(); }
});

test('matching restart and stage picker cancel a pending next-batch transition', () => {
  const h = harness();
  try {
    function finishBatch() {
      for (let pair = 0; pair < 5; pair++) {
        const left = h.query('.tile[data-side="left"]:not(.is-matched)');
        const right = h.all('.tile[data-side="right"]').find(node => node.dataset.k === left.dataset.k);
        left.click();
        right.click();
        h.advance(620);
      }
    }
    h.route('matching');
    h.query('.stage-opt').click();
    finishBatch();
    h.button('重玩本關').click();
    h.advance(1500);
    assert.equal(h.all('.hud__value')[2].textContent, '1 / 2', 'A restarted stage must stay in its new first batch');
    assert.equal(h.all('.tile[data-side="left"]:not(.is-matched)').length, 5);
    finishBatch();
    h.button('換關卡').click();
    h.advance(1500);
    assert.notEqual(h.query('.stage-list').parentElement.style.display, 'none');
    assert.equal(h.query('.match-board').parentElement.parentElement.style.display, 'none');
    assert.equal(h.query('.modal-backdrop'), null);
    h.clean();
  } finally { h.close(); }
});

test('final matching ignores rapid duplicate clicks while its window is being replaced', () => {
  const h = harness();
  try {
    h.window.localStorage.setItem(h.window.KanaData.MATCHING_UNLOCK_KEY, '6');
    h.route('matching');
    h.query('.stage-opt[data-stage="5"]').click();
    const left = h.query('.tile[data-side="left"]');
    const right = h.all('.tile[data-side="right"]').find(node => node.dataset.k === left.dataset.k);
    left.click();
    right.click();
    left.click();
    right.click();
    h.window.dispatchEvent(new h.window.Event('resize'));
    h.advance(230);
    const other = h.all('.tile[data-side="left"]').find(node => node !== left);
    other.click();
    h.all('.tile[data-side="right"]').find(node => node.dataset.k === other.dataset.k).click();
    h.advance(390);
    assert.equal(h.all('.hud__value')[0].textContent, '100', 'The in-flight pair may only score once');
    assert.equal(h.all('.hud__value')[3].textContent, '45');
    assert.equal(h.all('.tile[data-side="left"]').length, 5);
    h.clean();
  } finally { h.close(); }
});

for (const size of [3, 4, 5, 6, 7]) {
  test(`memory ${size}×${size} renders the right pairs, preview, and odd-card option`, () => {
    const h = harness();
    try {
      h.route('memory');
      h.query(`.size-opt[data-size="${size}"]`).click();
      const pairs = Math.floor(size * size / 2);
      const cards = memoryCards(h);
      assert.equal(cards.length, size * size);
      assert.equal(cards.filter(card => card.bonus).length, size % 2);
      assert.equal(cards.filter(card => card.romaji).length, pairs);
      const kana = cards.filter(card => !card.bonus && !card.romaji);
      assert.equal(kana.length, pairs);
      assert.equal(new Set(kana.map(card => card.value)).size, pairs);
      kana.forEach(card => {
        assert.equal(cards.filter(other => other.romaji && other.value === h.window.KanaData.romajiOf(card.value)).length, 1);
      });
      if (size >= 5) {
        assert.ok(cards.every(card => card.button.disabled && card.button.classList.contains('is-preview')));
        h.advance(7000);
        assert.ok(cards.every(card => !card.button.disabled && !card.button.classList.contains('is-preview')));
      }
      if (size % 2) {
        h.button('萬用卡：開').click();
        assert.equal(memoryCards(h).length, pairs * 2);
        assert.equal(h.all('.mcard--blank').length, 1);
        assert.equal(memoryCards(h).filter(card => card.bonus).length, 0);
        h.button('萬用卡：關').click();
        assert.equal(memoryCards(h).length, size * size);
        assert.equal(h.all('.mcard--blank').length, 0);
      }
      h.clean();
    } finally { h.close(); }
  });
}

test('memory wildcard resolves a complete pair and leaves every remaining pair solvable', () => {
  const h = harness();
  try {
    h.route('memory');
    h.query('.size-opt[data-size="3"]').click();
    const cards = memoryCards(h);
    const wild = cards.find(card => card.bonus);
    const kana = cards.find(card => !card.bonus && !card.romaji);
    wild.button.click();
    kana.button.click();
    h.advance(620);
    assert.equal(h.all('.mcard.is-done').length, 3, 'A wildcard completes itself, the chosen card, and its partner');
    cards.filter(card => !card.bonus && !card.romaji && !card.button.classList.contains('is-done')).forEach(card => {
      card.button.click();
      cards.find(other => other.romaji && other.value === h.window.KanaData.romajiOf(card.value)).button.click();
      h.advance(620);
    });
    h.advance(700);
    assert.match(h.query('.modal__title').textContent, /配對完成/);
    assert.equal(h.all('.mcard.is-done').length, 9);
    h.clean();
  } finally { h.close(); }
});

test('leaving memory before its delayed completion cannot open a modal on another route', () => {
  const h = harness();
  try {
    h.route('memory');
    h.query('.size-opt[data-size="3"]').click();
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
    h.query('.size-opt[data-size="3"]').click();
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
    assert.equal(h.all('.hud__value')[1].textContent, '0 / 4');
    h.clean();
  } finally { h.close(); }
});

for (const [random, expectedKanaMode] of [[0.01, true], [0.99, false]]) {
  test(`sentence ${expectedKanaMode ? 'kana' : 'romaji'} prompts can retry and complete all 15 questions`, () => {
    const h = harness(random);
    try {
      h.route('sentence');
      const seen = [];
      for (let index = 0; index < 15; index++) {
        const { item, kanaMode, answers } = question(h);
        assert.equal(kanaMode, expectedKanaMode);
        assert.equal(item.tier, Math.floor(index / 5) + 1, 'Difficulty should progress from words to complete sentences');
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
      assert.equal(new Set(seen).size, 15);
      assert.match(h.query('.modal__title').textContent, /全部答完/);
      const accuracy = h.all('.modal__stat').find(node => node.querySelector('span').textContent === '一次答對率');
      assert.equal(accuracy.querySelector('b').textContent, '93%', 'The retried question must be excluded from first-try accuracy');
      h.clean();
    } finally { h.close(); }
  });
}

test('changing sentence questions or routes cancels pending answer speech', () => {
  const h = harness();
  try {
    h.route('sentence');
    fillSentence(h, question(h).answers);
    check(h).click();
    check(h).click();
    let spokenBefore = h.spoken.length;
    h.advance(5000);
    assert.equal(h.spoken.length, spokenBefore, 'Advancing immediately must cancel old answer speech');
    fillSentence(h, question(h).answers);
    check(h).click();
    h.advance(400); // The answer has spoken; its praise is still pending.
    h.route('memory');
    spokenBefore = h.spoken.length;
    h.advance(5000);
    assert.equal(h.spoken.length, spokenBefore, 'Leaving must cancel the delayed encouragement too');
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
    const input = h.query('.romaji-input input');
    input.value = 'zzz';
    h.button('填入', '.romaji-input button').click();
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
