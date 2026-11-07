import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';

function harness(file, url = 'https://nihongo.test/' + file) {
  const errors = [], spoken = [], timers = new Map();
  let nextTimer = 0, seed = 12345;
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', virtualConsole: console });
  const { window } = dom;
  window.Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  window.scrollTo = () => {};
  window.setTimeout = fn => { const id = ++nextTimer; timers.set(id, fn); return id; };
  window.clearTimeout = id => timers.delete(id);
  window.speechSynthesis = { cancel() {}, speak: utterance => spoken.push(utterance.text) };
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  window.localStorage.setItem('jpq.progress.v1', '{"keep":true}');
  window.localStorage.setItem('niiki.mistakes', '{"keep":true}');
  for (const script of window.document.querySelectorAll('script:not([type="application/ld+json"])')) {
    const source = script.src
      ? readFileSync(new URL('../' + new URL(script.src).pathname.slice(1), import.meta.url), 'utf8')
      : script.textContent;
    new vm.Script(source).runInContext(dom.getInternalVMContext());
  }
  return {
    window, spoken, errors,
    query: selector => window.document.querySelector(selector),
    all: selector => [...window.document.querySelectorAll(selector)],
    data: name => vm.runInContext(name, dom.getInternalVMContext()),
    key(key, options = {}) { window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, ...options })); },
    nextTick() { const pending = [...timers]; for (const [id, fn] of pending) if (timers.delete(id)) fn(); },
    close() {
      assert.deepEqual(errors, []);
      assert.equal(window.localStorage.getItem('jpq.progress.v1'), '{"keep":true}');
      assert.equal(window.localStorage.getItem('niiki.mistakes'), '{"keep":true}');
      dom.window.close();
    }
  };
}

test('full progress reset is available only on loopback pages and still requires local confirmation', () => {
  for (const [host, local] of [
    ['https://nihongo-2-static.onrender.com', false],
    ['https://abc6024.github.io', false],
    ['https://localhost.example.com', false],
    ['http://192.168.1.2:8000', false],
    ['http://localhost:8000', true],
    ['http://127.0.0.1:8000', true],
    ['http://[::1]:8000', true]
  ]) {
    const h = harness('katakana_game.html', host + '/katakana_game.html?local=1');
    try {
      assert.equal(Boolean(h.query('#resetBtn')), local, host);
      if (local) {
        h.query('#resetBtn').click();
        assert.equal(h.query('#modalTitle').textContent, '清除所有進度？');
        const cancel = h.all('#modalActions button').find(button => button.textContent === '取消');
        cancel.click();
        assert.ok(h.query('#modal').classList.contains('hidden'));
      } else {
        // A stale reset control must not gain a working handler on public pages.
        const stale = h.window.document.createElement('button');
        stale.id = 'resetBtn';
        h.window.document.body.appendChild(stale);
        h.window.JPQ.site.wireTools();
        assert.equal(h.query('#resetBtn'), null);
      }
    } finally { h.close(); }
  }
});

test('imported games use the shared header and footer with the current category highlighted', () => {
  for (const file of ['katakana_game.html', 'n5_reading_game.html']) {
    const h = harness(file);
    try {
      assert.equal(h.query('.site-menu a[aria-current="page"]').getAttribute('href'), file);
      assert.deepEqual(h.all('.site-menu a').slice(1, -1).map(a => a.textContent), ['五十音', '助詞', '片假名單字', '聽打', '動詞', '閱讀']);
      assert.ok(h.query('.site-footer'));
      for (const link of h.all('.site-menu a')) {
        const target = link.getAttribute('href').split('#')[0];
        assert.ok(existsSync(new URL('../' + target, import.meta.url)), `Missing navigation target: ${target}`);
      }
      h.query('#startBtn').click();
      assert.equal(h.window.document.body.dataset.screen, 'quiz');
      h.query('#learnBtn').click();
      assert.ok(!h.query('#modal').classList.contains('hidden'));
      h.key('1');
      assert.equal(h.query('#okNo').textContent, '0', 'Opening site tools must prevent answering behind the dialog');
    } finally { h.close(); }
  }
});

for (const mode of ['k2z', 'z2k', 'mix']) {
  test(`katakana ${mode} completes ten questions, scores once and reveals only visible audio`, () => {
    const h = harness('katakana_game.html');
    try {
      const radio = h.query(`input[value="${mode}"]`);
      radio.checked = true;
      radio.dispatchEvent(new h.window.Event('change', { bubbles: true }));
      const words = Array.from(h.data('WORDS'));
      assert.equal(words.find(w => w.k === 'アメリカ').z, '美國');
      assert.equal(words.find(w => w.k === 'アイスクリーム').z, '冰淇淋');
      assert.deepEqual([...new Set(words.map(w => w.l))], Array.from({ length: 12 }, (_, i) => i + 1));
      h.query('#startBtn').click();
      const seen = new Set();
      for (let n = 0; n < 10; n++) {
        const prompt = h.query('#word').textContent;
        const word = words.find(w => w.k === prompt || w.z === prompt);
        assert.ok(word, 'The displayed prompt belongs to the supplied bank');
        assert.ok(!seen.has(word.k), 'The full-bank round should not repeat words');
        seen.add(word.k);
        const buttons = h.all('#options .opt');
        assert.equal(buttons.length, 4);
        assert.equal(new Set(buttons.map(b => b.textContent)).size, 4);
        h.key('1', { repeat: true });
        h.key('1', { ctrlKey: true });
        assert.equal(h.query('#okNo').textContent, String(n));
        if (prompt === word.k) {
          h.query('#speakBtn').click();
          assert.equal(h.spoken.at(-1), word.k);
        } else assert.equal(h.query('#speakBtn').style.display, 'none', 'Chinese-to-katakana questions must not offer an answer audio hint');
        const correct = buttons.find(b => b.dataset.k === word.k);
        correct.click(); correct.click();
        assert.equal(h.query('#okNo').textContent, String(n + 1), 'A double click must score only once');
        h.nextTick();
      }
      assert.equal(h.query('#screen-result').classList.contains('hidden'), false);
      assert.equal(h.query('#finalScore').textContent, '10');
      h.query('#againBtn').click();
      assert.equal(h.query('#qNo').textContent, '1');
      assert.equal(h.query('#okNo').textContent, '0');
    } finally { h.close(); }
  });
}

test('each katakana lesson including small three-word banks starts a complete ten-question round', () => {
  const h = harness('katakana_game.html');
  try {
    const words = Array.from(h.data('WORDS'));
    for (let lesson = 1; lesson <= 12; lesson++) {
      h.query(`.chip[data-l="${lesson}"]`).click(); h.query('#startBtn').click();
      assert.equal(h.query('#qTotal').textContent, '10');
      for (let n = 0; n < 10; n++) {
        const current = words.find(w => w.k === h.query('#word').textContent);
        assert.equal(current.l, lesson);
        h.all('#options .opt').find(b => b.dataset.k === current.k).click();
        h.nextTick();
      }
      h.query('#backBtn').click();
      assert.equal(h.query('#screen-start').classList.contains('hidden'), false);
    }
  } finally { h.close(); }
});

test('reading completes ten distinct passages, locks grading and protects unanswered questions', () => {
  const h = harness('n5_reading_game.html');
  try {
    const bank = Array.from(h.data('QUIZ'));
    assert.equal(bank.length, 20);
    assert.equal(bank[0].o[bank[0].a], 'コーヒー');
    assert.equal(bank[10].o[bank[10].a], '５００えん');
    bank.forEach(q => { assert.equal(q.o.length, 4); assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < 4); assert.ok(q.tr && q.why); });
    h.query('#startBtn').click();
    const seen = new Set();
    for (let n = 0; n < 10; n++) {
      const passage = h.query('#passage').textContent;
      assert.ok(!seen.has(passage)); seen.add(passage);
      const q = bank.find(q => q.p === passage);
      assert.ok(q);
      assert.ok(!h.query('#trans').classList.contains('show'));
      h.query('#peekBtn').click();
      assert.ok(h.query('#trans').classList.contains('show'));
      h.query('#nextBtn').click();
      assert.equal(h.query('#qNo').textContent, String(n + 1), 'The hidden next button cannot skip an unanswered question');
      const choice = h.query(`#options .opt[data-i="${q.a}"]`);
      choice.click(); choice.click();
      assert.equal(h.query('#okNo').textContent, String(n + 1));
      assert.ok(h.query('#fbBody').textContent.includes(q.why));
      h.key('Enter', { repeat: true });
      assert.equal(h.query('#qNo').textContent, String(n + 1));
      h.key('Enter');
    }
    assert.equal(h.query('#screen-result').classList.contains('hidden'), false);
    assert.equal(h.query('#finalScore').textContent, '10');
    h.query('#againBtn').click();
    assert.equal(h.query('#qNo').textContent, '1');
  } finally { h.close(); }
});

test('wrong katakana and reading answers appear in the end-of-round review', () => {
  for (const file of ['katakana_game.html', 'n5_reading_game.html']) {
    const h = harness(file);
    try {
      h.query('#startBtn').click();
      for (let n = 0; n < 10; n++) {
        if (file.startsWith('katakana')) {
          const word = Array.from(h.data('WORDS')).find(w => w.k === h.query('#word').textContent);
          h.all('#options .opt').find(b => b.dataset.k !== word.k).click();
          h.nextTick();
        } else {
          const q = Array.from(h.data('QUIZ')).find(q => q.p === h.query('#passage').textContent);
          h.all('#options .opt').find(b => Number(b.dataset.i) !== q.a).click();
          h.query('#nextBtn').click();
        }
      }
      assert.equal(h.query('#finalScore').textContent, '0');
      assert.equal(h.all('#review .review-item').length, 10);
    } finally { h.close(); }
  }
});
