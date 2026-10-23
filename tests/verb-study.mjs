import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = new URL('../', import.meta.url);
const source = file => readFileSync(new URL(file, root), 'utf8');
const forms = ['te', 'nai', 'base', 'ta', 'masu'];
const removedForms = ['masen', 'mashita', 'masendeshita', 'nakatta', 'mashimashou', 'masenka', 'tara'];
const advancedForms = ['dekita', 'you', 'meirei', 'kinshi', 'kate', 'ukerare', 'saseru', 'darou'];
const topicNumbers = [1, 2, 3, 4, 12];
const removedTopicNumbers = [5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19];
const types = ['godan', 'ichidan', 'suru', 'kuru'];
const verbIdentity = verb => verb.id || verb.kana;

function dataHarness(random = Math.random) {
  const sandbox = { Math: Object.create(Math) };
  sandbox.Math.random = random;
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  ['verb-data', 'verb-vocab', 'verb-beginner', 'verb-levels'].forEach(name => {
    new vm.Script(source(`js/${name}.js`), { filename: `js/${name}.js` }).runInContext(context);
  });
  return sandbox.JPQ;
}

function validateRound(J, questions, expectedBook = 'all', expectedForms = forms) {
  assert.equal(questions.length, 10, 'A round must always contain ten questions');
  assert.equal(new Set(questions.map(q => verbIdentity(q.verb))).size, 10, 'A verb may appear only once per round, even with mixed forms');
  questions.forEach(q => {
    assert.ok(J.verbStudy.VOCAB.includes(q.verb), `${q.verb.kana} must come from the curated textbook pool`);
    assert.ok(expectedForms.includes(q.key), `${q.key} is outside the selected form range`);
    if (expectedBook !== 'all') assert.equal(q.verb.book, Number(expectedBook));
    assert.equal(q.a, J.verb.conjugate(q.verb, q.key));
    assert.equal(q.opts.length, 2);
    assert.equal(new Set([q.a, ...q.opts]).size, 3, `${q.verb.kana} ${q.key} needs three distinct choices`);
    assert.ok(q.opts.every(option => typeof option === 'string' && option.length > 1));
  });
}

test('textbook vocabulary retains lesson provenance, two volumes, and distinct verb identities', () => {
  const J = dataHarness();
  const vocab = J.verbStudy.VOCAB;
  assert.equal(vocab, J.verbVocab.VERBS, 'The study pool must use the audited vocabulary alias');
  assert.equal(vocab.length, 132, 'Reducing the form range must retain the audited textbook vocabulary');
  assert.equal(new Set(vocab.map(verbIdentity)).size, vocab.length);
  [1, 2].forEach(book => assert.ok(vocab.filter(v => v.book === book).length >= 10, `Volume ${book} needs at least ten verbs`));
  vocab.forEach(v => {
    assert.ok(v.kana && v.zh, 'Every tested verb needs a reading and Chinese meaning');
    assert.ok(Number.isInteger(v.lesson) && v.lesson >= 1 && v.lesson <= 25);
    assert.equal(v.book, v.lesson <= 12 ? 1 : 2);
    assert.ok(types.includes(v.type));
  });
  assert.deepEqual(Array.from(J.verbStudy.LESSONS, lesson => lesson.forms[0]).sort(), forms.slice().sort());
  assert.deepEqual(Array.from(J.verbStudy.FORM_KEYS), forms, 'The public practice allowlist must contain only five basic forms');
  J.verbStudy.LESSONS.forEach((lesson, i) => {
    assert.equal(lesson.no, topicNumbers[i]);
    assert.equal(lesson.count, 10);
  });
});

test('the underlying conjugation engine retains fixed answers independently of the public practice range', () => {
  const J = dataHarness();
  const answers = [
    ['かく', 'かきます', 'かきません', 'かきました', 'かきませんでした', 'かかなかった', 'かきましょう', 'かきませんか', 'かいたら'],
    ['かう', 'かいます', 'かいません', 'かいました', 'かいませんでした', 'かわなかった', 'かいましょう', 'かいませんか', 'かったら'],
    ['たべる', 'たべます', 'たべません', 'たべました', 'たべませんでした', 'たべなかった', 'たべましょう', 'たべませんか', 'たべたら'],
    ['する', 'します', 'しません', 'しました', 'しませんでした', 'しなかった', 'しましょう', 'しませんか', 'したら'],
    ['べんきょうする', 'べんきょうします', 'べんきょうしません', 'べんきょうしました', 'べんきょうしませんでした', 'べんきょうしなかった', 'べんきょうしましょう', 'べんきょうしませんか', 'べんきょうしたら'],
    ['くる', 'きます', 'きません', 'きました', 'きませんでした', 'こなかった', 'きましょう', 'きませんか', 'きたら'],
    ['ある', 'あります', 'ありません', 'ありました', 'ありませんでした', 'なかった', 'ありましょう', 'ありませんか', 'あったら']
  ];
  answers.forEach(([kana, ...expected]) => {
    ['masu', 'masen', 'mashita', 'masendeshita', 'nakatta', 'mashimashou', 'masenka', 'tara'].forEach((key, i) => {
      assert.equal(J.verb.conjugate(J.verb.byKana(kana), key), expected[i], `${kana} → ${key}`);
    });
  });
});

test('default mixed draw uses ten distinct textbook verbs and can draw both volumes', () => {
  let seed = 371;
  const J = dataHarness(() => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296));
  const books = new Set();
  const seenForms = new Set();
  for (let run = 0; run < 12; run++) {
    const questions = J.verbGame.build();
    validateRound(J, questions);
    questions.forEach(q => { books.add(q.verb.book); seenForms.add(q.key); });
  }
  assert.deepEqual([...books].sort(), [1, 2]);
  assert.deepEqual([...seenForms].sort(), forms.slice().sort(), 'Mixed practice must draw only the five basic forms');
});

test('every beginner form and either textbook volume produces a complete non-repeating round', () => {
  const J = dataHarness();
  ['1', '2'].forEach(book => forms.forEach(key => {
    validateRound(J, J.verbGame.build({ book, forms: [key], types, count: 10 }), book, [key]);
  }));
});

test('an extreme random source cannot stall the ten-verb draw', { timeout: 3000 }, () => {
  [0, 0.999999999].forEach(random => {
    let calls = 0;
    const J = dataHarness(() => {
      assert.ok(++calls < 20_000, 'Selection must not repeatedly retry already selected verbs');
      return random;
    });
    ['all', '1', '2'].forEach(book => {
      const questions = J.verbGame.build({ book, forms, types, count: 10 });
      validateRound(J, questions, book);
      assert.ok(new Set(questions.map(q => q.key)).size > 1, 'Mixed rounds must stay mixed even with an extreme random source');
    });
  });
});

test('out-of-scope forms cannot be requested and round length stays fixed at ten', () => {
  const J = dataHarness();
  [...removedForms, ...advancedForms].forEach(key => {
    assert.equal(J.verbGame.build({ book: 'all', forms: [key], count: 10, types }).length, 0,
      `Explicit out-of-scope form ${key} must not fall back to a different practice`);
    ['all', '1', '2'].forEach(book => assert.equal(J.verbStudy.configFor(`#/play/verb-quiz/${key}/${book}`), null,
      `Removed form route ${key}/${book} must not produce a practice config`));
  });
  removedTopicNumbers.forEach(no => ['all', '1', '2'].forEach(book => {
    assert.equal(J.verbStudy.configFor(`#/play/verb-quiz/${no}/${book}`), null,
      `Removed topic route ${no}/${book} must not produce a practice config`);
  }));
  [3, 99].forEach(count => validateRound(J, J.verbGame.build({ book: 'all', forms, count, types })));
});

test('the shared pool excludes removed forms, advanced forms, and non-textbook verbs', () => {
  const J = dataHarness();
  const pool = J.verbGame.poolAll();
  assert.ok(pool.length > 100);
  const seen = new Set();
  pool.forEach(q => {
    const signature = `${verbIdentity(q.verb)}:${q.key}`;
    assert.ok(!seen.has(signature), `Duplicate shared question: ${signature}`);
    seen.add(signature);
    assert.ok(forms.includes(q.key));
    assert.ok(J.verbStudy.VOCAB.includes(q.verb));
    assert.equal(new Set([q.a, ...q.opts]).size, 3);
  });
  assert.deepEqual([...new Set(pool.map(q => q.key))].sort(), forms.slice().sort());
});

async function uiHarness() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const html = source('conjugation.html');
  const dom = new JSDOM(html, { url: 'https://nihongo.test/conjugation.html#/',
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  const { document } = window;
  await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  window.scrollTo = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  // jsdom has no media playback. Keep game clicks and reader cleanup real while
  // leaving network/audio verification to click-tts.mjs and browser checks.
  window.Audio = class extends window.EventTarget {
    constructor(url) { super(); this.src = url || ''; }
    play() { return Promise.resolve(); }
    pause() {}
    load() {}
    removeAttribute(name) { if (name === 'src') this.src = ''; }
  };
  window.fetch = async () => ({ ok: true, json: async () => ({ ok: true, boards: {} }) });
  document.querySelectorAll('script[src]').forEach(script => {
    const file = script.getAttribute('src').split('?')[0];
    window.eval(source(file) + `\n//# sourceURL=${file}`);
  });
  const J = window.JPQ;
  const rounds = [], runs = [], answers = [];
  const build = J.verbGame.build;
  J.verbGame.build = config => { const questions = build(config); rounds.push(questions); return questions; };
  J.stats.answer = (...args) => answers.push(args);
  J.stats.run = (...args) => runs.push(args);
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const query = selector => document.querySelector(selector);
  const route = hash => {
    dom.reconfigure({ url: `https://nihongo.test/conjugation.html${hash}` });
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  };
  // Hash assignment dispatches asynchronously in browsers. Drive the actual router
  // deterministically after click/submit without waiting for jsdom's event queue.
  const settle = () => { J.modal.close(); J.router(); };
  const submit = () => {
    query('#verbPracticeForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    settle();
  };
  const answer = (index, correct = true) => {
    const q = rounds.at(-1)[index];
    const options = [...document.querySelectorAll('#stage .opt')];
    const option = options.find(node => correct ? node.dataset.o === q.a : node.dataset.o !== q.a);
    assert.ok(option, `Question ${index + 1} needs a selectable answer`);
    option.click();
    return option;
  };
  return { window, document, J, errors, rounds, runs, answers, query, route, settle, submit, answer,
    close() { J.tts?.stop(); dom.window.close(); } };
}

test('the shipped practice settings default to both books and mixed forms, with ten-question copy', async () => {
  const h = await uiHarness();
  try {
    assert.equal(h.query('#verbBook').value, 'all');
    assert.equal(h.query('#verbForm').value, 'mixed');
    assert.deepEqual([...h.query('#verbForm').options].map(option => option.value), ['mixed', ...forms],
      'Settings must offer mixed practice plus exactly five basic forms');
    assert.deepEqual([...h.query('#vbStudyForm').options].map(option => option.value), forms,
      'The reference sheet must expose the same five basic forms');
    [...removedForms, ...advancedForms].forEach(key => {
      assert.ok(!h.document.querySelector(`a[href*="/verb-quiz/${key}"]`), `Removed form ${key} must not have a topic link`);
    });
    assert.ok(h.query('#view-home').textContent.includes('10'));
    assert.ok(!/6\s*題/.test(h.query('#view-home').textContent));
    h.submit();
    validateRound(h.J, h.rounds.at(-1));
    for (let i = 0; i < 10; i++) {
      const q = h.rounds.at(-1)[i];
      const label = h.J.verbStudy.LESSONS.find(lesson => lesson.forms[0] === q.key).title;
      assert.equal(h.query('#stage .vb-form').textContent.trim(), label, 'Every mixed question must name its actual target form');
      h.answer(i);
      h.query('#nextBtn').click();
    }
    assert.ok(h.query('#verbResult'));
    h.query('#verbSettings').click(); h.settle();
    assert.ok(!h.query('#view-home').classList.contains('hidden'), 'Result settings should return to the visible practice form');
    assert.deepEqual(h.runs, [['verb-quiz', 10, 10]], 'Returning to settings must not duplicate a finished session');
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('compound verbs and katakana keep correct spelling and furigana in questions and choices', async () => {
  const h = await uiHarness();
  try {
    [
      ['買い物する', 'te', '買[か]い物[もの]して'],
      ['買い物する', 'nai', '買[か]い物[もの]しない'],
      ['乗り換える', 'te', '乗[の]り換[か]えて'],
      ['コピーする', 'te', 'コピーして']
    ].forEach(([id, key, expected]) => {
      const verb = h.J.verbStudy.VOCAB.find(v => v.id === id);
      assert.ok(verb);
      assert.equal(h.J.verb.display(verb, key), expected);
    });
    const ids = ['買い物する', '乗り換える', 'コピーする'];
    const holder = h.document.createElement('span');
    h.J.verbGame.poolAll().filter(q => ids.includes(q.verb.id)).forEach(q => {
      [q.a, ...q.opts].forEach(answer => {
        holder.innerHTML = h.J.util.ruby(h.J.verb.displayKana(q.verb, answer));
        assert.ok(!/[\[\]]/.test(holder.textContent), `${q.verb.id}: furigana markup must be fully rendered`);
        holder.querySelectorAll('ruby').forEach(ruby => ruby.replaceWith(ruby.querySelector('rt').textContent));
        assert.equal(holder.textContent, answer, `${q.verb.id}: the rendered reading must preserve the answer`);
      });
    });
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('ten answers finish once; retry, settings, and leaving do not duplicate round records', async () => {
  const h = await uiHarness();
  try {
    h.query('#verbBook').value = '2';
    h.query('#verbForm').value = 'nai';
    h.submit();
    validateRound(h.J, h.rounds.at(-1), '2', ['nai']);
    for (let i = 0; i < 10; i++) {
      const option = h.answer(i, i !== 3);
      option.click();
      assert.equal(h.answers.length, i + 1, 'Repeated answer clicks must not score twice');
      const next = h.query('#nextBtn');
      assert.ok(next);
      next.click();
      next.click();
    }
    assert.ok(h.query('#verbResult'));
    assert.ok(h.query('#verbReview'));
    assert.deepEqual(h.runs, [['verb-quiz', 10, 9]]);
    h.query('#verbRetry').click();
    assert.equal(h.rounds.length, 2);
    validateRound(h.J, h.rounds.at(-1), '2', ['nai']);
    assert.equal(h.runs.length, 1);
    h.answer(0);
    h.route('#/');
    assert.equal(h.runs.length, 1, 'Leaving an incomplete round must not report a completed ten-question session');
    assert.equal(h.answers.length, 11, 'Already answered question statistics remain available');
    h.route('#/play/verb-quiz/te/1');
    validateRound(h.J, h.rounds.at(-1), '1', ['te']);
    h.route('#/');
    assert.equal(h.runs.length, 1);
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('basic topic links retain ten-question rounds and removed topic links cannot start questions', async () => {
  const h = await uiHarness();
  try {
    topicNumbers.forEach(no => {
      h.route(`#/play/verb-quiz/${no}`);
      validateRound(h.J, h.rounds.at(-1), 'all', [forms[topicNumbers.indexOf(no)]]);
    });
    [...removedTopicNumbers, ...removedForms, ...advancedForms].forEach(no => {
      const before = h.rounds.length;
      h.route(`#/play/verb-quiz/${no}`);
      assert.equal(h.rounds.length, before, `Removed topic ${no} must not create questions`);
      const choose = h.query('#stage #verbChoose');
      assert.ok(choose, 'Removed advanced links should provide a return to practice settings');
      choose.click(); h.settle();
      assert.ok(!h.query('#view-home').classList.contains('hidden'));
    });
    assert.deepEqual(h.errors, []);
    assert.equal(h.runs.length, 0);
  } finally { h.close(); }
});
