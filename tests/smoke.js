'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createHash } = require('crypto');
const { execFileSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function compileJavaScript() {
  const files = fs.readdirSync(path.join(ROOT, 'js'))
    .filter(file => file.endsWith('.js'))
    .concat(['server.js']);

  files.forEach(file => {
    const fullPath = file === 'server.js'
      ? path.join(ROOT, file)
      : path.join(ROOT, 'js', file);
    new vm.Script(fs.readFileSync(fullPath, 'utf8'), { filename: file });
  });
}

function loadData() {
  const sandbox = {};
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  ['data.js', 'kana-data.js', 'vocab-data.js', 'verb-data.js', 'verb-vocab.js', 'verb-beginner.js', 'verb-levels.js'].forEach(file => {
    const source = fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
    new vm.Script(source, { filename: file }).runInContext(context);
  });
  return context;
}

function validateLearningData() {
  const JPQ = loadData().JPQ;
  const questions = JPQ.LEVELS.flatMap(level => level.qs).concat(JPQ.SPEED_EXTRA);
  JPQ.SCRAMBLE.forEach((question, index) => {
    assert(Array.isArray(question.particles) && question.particles.length,
      `Scramble ${index + 1} needs explicit particles for learning statistics`);
    assert.strictEqual(new Set(question.particles).size, question.particles.length);
    question.particles.forEach(k => assert(JPQ.PARTICLES.some(p => p.k === k),
      `Scramble ${index + 1} has an unknown particle ${k}`));
  });
  questions.forEach((question, index) => {
    assert.strictEqual((question.q.match(/__/g) || []).length, 1,
      `Question ${index + 1} must contain exactly one blank`);
    assert(question.opts.includes(question.a), `Question ${index + 1} is missing its answer`);
    assert.strictEqual(new Set(question.opts).size, question.opts.length,
      `Question ${index + 1} contains duplicate options`);
  });

  assert.strictEqual(JPQ.kana.list().length, 46, 'The basic kana list must contain 46 entries');
  assert.strictEqual(JPQ.kana.toKatakana('きゃ'), 'キャ');
  assert.strictEqual(JPQ.kana.toKatakana('し'), 'シ');
  assert.strictEqual(JPQ.KANA.find(row => row.row === 'や行').cells[2][0], 'ゆ');
  assert.strictEqual(JPQ.KANA.find(row => row.row === 'や行').cells[4][0], 'よ');
  assert.strictEqual(JPQ.KANA.find(row => row.row === 'わ行').cells[4][0], 'を');

  ['hiragana', 'katakana', 'vocabulary'].forEach(key => {
    const pool = JPQ.kanaPool[key];
    const items = pool.items;
    assert(items.length > 3, `字集 ${key} 至少要有 4 個選項`);
    assert.strictEqual(new Set(items.map(it => it.roman)).size, items.length,
      `字集 ${key} 的讀音不能重複，否則會出現兩個一樣的選項`);
    items.forEach(item => {
      ['char', 'roman', 'tag', 'speak'].forEach(field =>
        assert(item[field], `字集 ${key} 的項目缺少 ${field}`));
    });
  });
  assert.strictEqual(JPQ.kanaPool.hiragana.items[1].char, 'い');
  assert.strictEqual(JPQ.kanaPool.katakana.items[1].char, 'イ');
  assert.strictEqual(JPQ.kanaPool.vocabulary.items.length, JPQ.VOCAB.length);
  JPQ.VOCAB.forEach(word => assert(word.zh, `單字 ${word.char} 缺少中文解釋`));

  const learningSource = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
  [
    '日本語[にほんご]__　なれます',
    '妹[まなこ]',
    '休[やす]み日[び]',
    '東京[とうきょう]__　住[す]みます',
    '象[ぞう]__　鼻[はな]は　長[なが]いです。',
    '「これ／それ／あれ」開頭的這類疑問句固定用「は」',
    '今日[きょう]は寒[さむ]いです。妹[いもうと]__　セーターを着[き]ます。',
    '「也」「還有」，會取代原本的 は／が'
  ]
    .forEach(text => assert(!learningSource.includes(text), `Known invalid example returned: ${text}`));
}

/* =========================================================
   動詞活用規則引擎
   這裡刻意把答案寫死，不呼叫引擎去推自己的結果，
   免得規則錯了測試也跟著錯。
   ========================================================= */
function validateVerbData() {
  const JPQ = loadData().JPQ;
  const verb = JPQ.verb;
  assert(verb, 'js/verb-data.js must expose JPQ.verb');

  /* 小工具：取某個動詞的某個活用形（假名） */
  const c = (kana, key) => {
    const v = verb.byKana(kana);
    assert(v, `Unknown verb: ${kana}`);
    return verb.conjugate(v, key);
  };
  /* 顯示形式（漢字＋注音），去掉注音後比較純文字 */
  const d = (kana, key) => {
    const v = verb.byKana(kana);
    return verb.display(v, key).replace(/\[([^\]]+)\]/g, '');
  };

  /* ---------- 1. 五段九個詞尾 × て／た／な／意志／命令／条件 ----------
     答案全部寫死。刻意不從引擎的規則表推出來，
     否則規則寫錯了，測試也會跟著一起錯。 */
  const GODAN_ROWS = [
    /* 段   動詞    て形      た形      ない        意志形      命令形  条件形・ば */
    ['う', 'かう', 'かって',   'かった',   'かわない',   'かおう',   'かえ',  'かえば'],
    ['く', 'かく', 'かいて',   'かいた',   'かかない',   'かこう',   'かけ',  'かけば'],
    ['ぐ', 'およぐ', 'およいで', 'およいだ', 'およがない', 'およごう', 'およげ', 'およげば'],
    ['す', 'はなす', 'はなして', 'はなした', 'はなさない', 'はなそう', 'はなせ', 'はなせば'],
    ['つ', 'まつ', 'まって',   'まった',   'またない',   'まとう', 'まて', 'まてば'],
    ['ぬ', 'しぬ', 'しんで',   'しんだ',   'しなない',   'しのう',   'しね',  'しねば'],
    ['ぶ', 'とぶ', 'とんで',   'とんだ',   'とばない',   'とぼう',   'とべ',  'とべば'],
    ['む', 'よむ', 'よんで',   'よんだ',   'よまない',   'よもう',   'よめ',  'よめば'],
    ['る', 'しる', 'しって',   'しった',   'しらない',   'しろう',   'しれ',  'しれば']
  ];
  GODAN_ROWS.forEach(([col, kana, te, ta, nai, you, meirei, kate]) => {
    const v = verb.byKana(kana);
    assert(v, `Unknown verb: ${kana}`);
    assert.strictEqual(v.type, 'godan', `${kana} must be a godan verb`);
    assert.strictEqual(v.col, col, `${kana} must be in the ${col} row`);
    assert.strictEqual(verb.conjugate(v, 'te'), te, `${kana} → て形 must be ${te}`);
    assert.strictEqual(verb.conjugate(v, 'ta'), ta, `${kana} → た形 must be ${ta}`);
    assert.strictEqual(verb.conjugate(v, 'nai'), nai, `${kana} → ない must be ${nai}`);
    assert.strictEqual(verb.conjugate(v, 'you'), you, `${kana} → 意志形 must be ${you}`);
    assert.strictEqual(verb.conjugate(v, 'meirei'), meirei, `${kana} → 命令形 must be ${meirei}`);
    assert.strictEqual(verb.conjugate(v, 'kate'), kate, `${kana} → 条件形・ば must be ${kate}`);
    /* 五段的連体形就是辞書形 */
    assert.strictEqual(verb.conjugate(v, 'tai'), v.kana, `${kana} → 連体形`);
  });

  /* ぐ／ぬ／ぶ／む 接で／だ */
  assert.strictEqual(c('およぐ', 'te'), 'およいで', 'ぐ段 → で');
  assert.strictEqual(c('しぬ', 'te'), 'しんで', 'ぬ段 → で');
  assert.strictEqual(c('とぶ', 'te'), 'とんで', 'ぶ段 → で');
  assert.strictEqual(c('よむ', 'te'), 'よんで', 'む段 → で');
  /* う／く／つ／る 有音便；す 接して／した */
  assert.strictEqual(c('かう', 'te'), 'かって');
  assert.strictEqual(c('はなす', 'te'), 'はなして');
  assert.strictEqual(c('まつ', 'te'), 'まって');
  assert.strictEqual(c('しる', 'te'), 'しって');

  /* ---------- 2. 字典形式特例：行く / ある ---------- */
  assert.strictEqual(c('いく', 'te'), 'いって', '行く → 行って（不是 行いて）');
  assert.strictEqual(c('いく', 'ta'), 'いった');
  assert.strictEqual(c('いく', 'masu'), 'いきます');
  assert.strictEqual(c('いく', 'nai'), 'いかない');

  assert.strictEqual(c('ある', 'te'), 'あって', 'ある → あって');
  assert.strictEqual(c('ある', 'ta'), 'あった');
  assert.strictEqual(c('ある', 'masu'), 'あります');
  assert.strictEqual(c('ある', 'nai'), 'ない');
  assert.strictEqual(c('ある', 'you'), 'あろう');

  /* 固定正解涵蓋此次修正會影響的每個動詞，不用引擎產生預期值。 */
  const corrected = [
    ['かう', 'かって', 'かった', 'かいます', 'かわない', 'かおう', 'かえ', 'かえば', 'かえる'],
    ['つかう', 'つかって', 'つかった', 'つかいます', 'つかわない', 'つかおう', 'つかえ', 'つかえば', 'つかえる'],
    ['あらう', 'あらって', 'あらった', 'あらいます', 'あらわない', 'あらおう', 'あらえ', 'あらえば', 'あらえる'],
    ['ならう', 'ならって', 'ならった', 'ならいます', 'ならわない', 'ならおう', 'ならえ', 'ならえば', 'ならえる'],
    ['まつ', 'まって', 'まった', 'まちます', 'またない', 'まとう', 'まて', 'まてば', 'まてる'],
    ['たつ', 'たって', 'たった', 'たちます', 'たたない', 'たとう', 'たて', 'たてば', 'たてる'],
    ['もつ', 'もって', 'もった', 'もちます', 'もたない', 'もとう', 'もて', 'もてば', 'もてる'],
    ['つくる', 'つくって', 'つくった', 'つくります', 'つくらない', 'つくろう', 'つくれ', 'つくれば', 'つくれる']
  ];
  corrected.forEach(([kana, ...answers]) => {
    ['te', 'ta', 'masu', 'nai', 'you', 'meirei', 'kate', 'dekita'].forEach((key, i) => {
      assert.strictEqual(c(kana, key), answers[i], `${kana}: corrected ${key}`);
    });
  });
  assert.strictEqual(verb.byKana('つくる').type, 'godan');
  assert.strictEqual(c('つくる', 'ukerare'), 'つくられる');
  assert.strictEqual(c('つくる', 'saseru'), 'つくらせる');
  assert.strictEqual(d('つかう', 'base'), '使う');
  assert.strictEqual(d('つかう', 'te'), '使って');
  assert.strictEqual(verb.displayKana(verb.byKana('つかう'), 'つかいた'), '使[つか]いた');
  assert.strictEqual(verb.displayKana(verb.byKana('のむ'), 'のみて'), '飲[の]みて');
  assert.strictEqual(verb.displayKana(verb.byKana('くる'), 'くて'), '来[く]て');
  [['かう', 'you', 'かお', 'う'], ['まつ', 'meirei', 'ま', 'て'],
   ['いく', 'te', 'い', 'って'], ['ある', 'nai', '', 'ない']].forEach(([kana, key, head, tail]) => {
    const split = verb.split(verb.byKana(kana), key);
    assert.strictEqual(split.head, head);
    assert.strictEqual(split.tail, tail);
  });
  verb.VERBS.forEach(v => verb.formsFor(v).forEach(f => {
    const explanation = verb.explain(v, f.key);
    assert.strictEqual(explanation.parts[explanation.parts.length - 1].kana, c(v.kana, f.key),
      `${v.kana}: explanation must end with the requested ${f.key}`);
  }));

  /* ---------- 3. 一段動詞 ---------- */
  assert.strictEqual(c('たべる', 'base'), 'たべる');
  assert.strictEqual(c('たべる', 'te'), 'たべて');
  assert.strictEqual(c('たべる', 'ta'), 'たべた');
  assert.strictEqual(c('たべる', 'tai'), 'たべる', '一段的連体形 = 辞書形');
  assert.strictEqual(c('たべる', 'nai'), 'たべない');
  assert.strictEqual(c('たべる', 'you'), 'たべよう');
  assert.strictEqual(c('たべる', 'meirei'), 'たべろ');
  assert.strictEqual(c('たべる', 'kate'), 'たべれば');
  assert.strictEqual(c('たべる', 'kinshi'), 'たべるな');
  assert.strictEqual(c('たべる', 'darou'), 'たべるだろう');
  assert.strictEqual(c('たべる', 'masu'), 'たべます');
  assert.strictEqual(c('たべる', 'masen'), 'たべません');
  assert.strictEqual(c('たべる', 'mashita'), 'たべました');
  assert.strictEqual(c('たべる', 'masendeshita'), 'たべませんでした');
  assert.strictEqual(c('たべる', 'mashimashou'), 'たべましょう');
  assert.strictEqual(c('たべる', 'masenka'), 'たべませんか');
  assert.strictEqual(c('たべる', 'dekita'), 'たべられる');
  assert.strictEqual(c('たべる', 'dekitaimasu'), 'たべられます');
  assert.strictEqual(c('たべる', 'ukerare'), 'たべられる');
  assert.strictEqual(c('たべる', 'ukeraremasen'), 'たべられません');
  assert.strictEqual(c('たべる', 'saseru'), 'たべさせる');
  assert.strictEqual(c('たべる', 'sasenai'), 'たべさせない');

  assert.strictEqual(verb.form('naiwake'), null, '移除不存在的連体形＋ない題型');

  /* ---------- 4. 五段的可能・受身・使役 ---------- */
  assert.strictEqual(c('かく', 'dekita'), 'かける');
  assert.strictEqual(c('かく', 'ukerare'), 'かかれる');
  assert.strictEqual(c('かく', 'saseru'), 'かかせる');
  assert.strictEqual(c('かく', 'sasenai'), 'かかせない');
  assert.strictEqual(c('かく', 'dekitaimasu'), 'かけます');
  assert.strictEqual(c('かく', 'ukeraremasen'), 'かかれません');
  assert.strictEqual(c('よむ', 'dekita'), 'よめる');
  assert.strictEqual(c('はなす', 'ukerare'), 'はなされる');

  assert.strictEqual(c('のる', 'nai'), 'のらない');

  /* ---------- 5. サ変・する ---------- */
  assert.strictEqual(c('する', 'te'), 'して');
  assert.strictEqual(c('する', 'ta'), 'した');
  assert.strictEqual(c('する', 'nai'), 'しない');
  assert.strictEqual(c('する', 'you'), 'しよう');
  assert.strictEqual(c('する', 'meirei'), 'しろ');
  assert.strictEqual(c('する', 'kate'), 'すれば');
  assert.strictEqual(c('する', 'tai'), 'する');
  assert.strictEqual(c('する', 'kinshi'), 'するな');
  assert.strictEqual(c('する', 'masu'), 'します');
  assert.strictEqual(c('する', 'masen'), 'しません');
  assert.strictEqual(c('する', 'mashita'), 'しました');
  assert.strictEqual(c('する', 'masendeshita'), 'しませんでした');
  assert.strictEqual(c('する', 'mashimashou'), 'しましょう');
  assert.strictEqual(c('する', 'masenka'), 'しませんか');
  assert.strictEqual(c('する', 'dekita'), 'できる');
  assert.strictEqual(c('する', 'ukerare'), 'される');
  assert.strictEqual(c('する', 'ukeraremasen'), 'されません');
  assert.strictEqual(c('する', 'saseru'), 'させる');
  assert.strictEqual(c('する', 'sasenai'), 'させない');

  /* サ変 + 名詞 */
  assert.strictEqual(c('べんきょうする', 'te'), 'べんきょうして');
  assert.strictEqual(c('べんきょうする', 'nai'), 'べんきょうしない');
  assert.strictEqual(c('べんきょうする', 'dekita'), 'べんきょうできる');
  assert.strictEqual(c('べんきょうする', 'ukerare'), 'べんきょうされる');
  assert.strictEqual(c('べんきょうする', 'saseru'), 'べんきょうさせる');
  assert.strictEqual(c('べんきょうする', 'masu'), 'べんきょうします');

  /* ---------- 6. カ変・来る ---------- */
  assert.strictEqual(c('くる', 'base'), 'くる');
  assert.strictEqual(c('くる', 'te'), 'きて');
  assert.strictEqual(c('くる', 'ta'), 'きた');
  assert.strictEqual(c('くる', 'tai'), 'くる');
  assert.strictEqual(c('くる', 'nai'), 'こない');
  assert.strictEqual(c('くる', 'you'), 'こよう');
  assert.strictEqual(c('くる', 'meirei'), 'こい');
  assert.strictEqual(c('くる', 'kate'), 'くれば');
  assert.strictEqual(c('くる', 'masu'), 'きます');
  assert.strictEqual(c('くる', 'masen'), 'きません');
  assert.strictEqual(c('くる', 'mashita'), 'きました');
  assert.strictEqual(c('くる', 'masenka'), 'きませんか');
  assert.strictEqual(c('くる', 'dekita'), 'こられる');
  assert.strictEqual(c('くる', 'ukerare'), 'こられる');
  assert.strictEqual(c('くる', 'ukeraremasen'), 'こられません');
  assert.strictEqual(c('くる', 'saseru'), 'こさせる');
  assert.strictEqual(c('くる', 'sasenai'), 'こさせない');

  /* ---------- 7. 帰る可能形及初級題庫排除的活用形 ---------- */
  assert.strictEqual(c('かえる', 'dekita'), 'かえれる');
  assert.strictEqual(c('かえる', 'dekitaimasu'), 'かえれます');
  assert.strictEqual(c('しる', 'dekita'), '', '知る 不再變 しれる');
  assert.strictEqual(c('ある', 'ukerare'), '', 'ある 沒有受身形');
  assert.strictEqual(c('ある', 'saseru'), '', 'ある 沒有使役形');
  assert.strictEqual(c('ある', 'naiwake'), '', 'ある 沒有連体形＋ない');
  /* 這些動詞本身還是要能正常出題 */
  assert.strictEqual(c('かえる', 'masu'), 'かえります');
  assert.strictEqual(c('しる', 'masu'), 'しります');
  assert.strictEqual(c('かえる', 'you'), 'かえろう', '五段的意志形接 う，不是 よう');

  /* ---------- 8. 漢字＋注音顯示 ---------- */
  assert.strictEqual(d('かく', 'base'), '書く');
  assert.strictEqual(d('かく', 'nai'), '書かない');
  assert.strictEqual(d('かく', 'te'), '書いて');
  assert.strictEqual(d('かく', 'masu'), '書きます');
  assert.strictEqual(d('およぐ', 'te'), '泳いで');
  assert.strictEqual(d('たべる', 'base'), '食べる');
  assert.strictEqual(d('たべる', 'te'), '食べて');
  assert.strictEqual(d('たべる', 'masu'), '食べます');
  assert.strictEqual(d('おしえる', 'base'), '教える', '注音只蓋住詞幹');
  assert.strictEqual(d('つくる', 'base'), '作る', '作る 是五段る結尾動詞');
  assert.strictEqual(d('つくる', 'te'), '作って', '作る 是五段，り促音便為っ');
  assert.strictEqual(d('する', 'te'), 'して', '純假名動詞不加注音');
  assert.strictEqual(d('べんきょうする', 'nai'), '勉強しない');
  assert.strictEqual(d('くる', 'base'), '来る');
  assert.strictEqual(d('くる', 'nai'), '来ない');
  assert.strictEqual(d('くる', 'te'), '来て');
  assert.strictEqual(d('くる', 'masenka'), '来ませんか');
  assert.strictEqual(d('いく', 'te'), '行って');
  /* ある 保持純假名：詞幹 ある 被 ない 的 な 整個取代，掛不上注音 */
  assert.strictEqual(d('ある', 'nai'), 'ない');
  assert.strictEqual(d('ある', 'te'), 'あって');
  assert.strictEqual(d('ある', 'masu'), 'あります');

  /* ---------- 9. 資料完整性 ---------- */
  const seen = new Set();
  verb.VERBS.forEach(v => {
    assert(v.ruby || v.ruby === '', `${v.kana}: ruby must be a string`);
    assert(v.kana && v.kana.split('').every(ch => {
      const code = ch.charCodeAt(0);
      return code >= 0x3042 && code <= 0x3093;   /* ぁ〜ん */
    }), `${v.kana}: kana must be written in hiragana`);
    assert(!seen.has(v.kana), `Duplicate verb: ${v.kana}`);
    seen.add(v.kana);
    assert(['godan', 'ichidan', 'suru', 'kuru'].includes(v.type),
      `${v.kana}: unknown conjugation type ${v.type}`);
    assert(v.zh, `${v.kana}: missing Chinese meaning`);

    /* 五段的 行／段 必須和假名一致，資料才不會自己打架 */
    if (v.type === 'godan') {
      assert.strictEqual(v.col, v.kana[v.kana.length - 1],
        `${v.kana}: col must be the last kana`);
      assert.strictEqual(v.row, v.kana.slice(0, -1),
        `${v.kana}: row must be the kana before the col`);
      assert.strictEqual(v.kana.length - 1, v.row.length,
        `${v.kana}: row and stem must cover the same kana length`);
    }

    /* 每個「有」的活用形都必須產生非空的假名，且字典形要能還原 */
    const forms = verb.formsFor(v);
    assert(forms.length >= 15, `${v.kana}: too few conjugation forms (${forms.length})`);
    forms.forEach(f => {
      const kana = verb.conjugate(v, f.key);
      assert(kana, `${v.kana} → ${f.label} produced nothing`);
      assert(verb.display(v, f.key), `${v.kana} → ${f.label} has no display form`);
    });
    assert.strictEqual(verb.conjugate(v, 'base'), v.kana,
      `${v.kana}: 辞書形 must equal the stored kana`);

    /* skip 清單裡的 key 必須真的存在，否則拼錯也沒人知道 */
    (v.skip || []).forEach(key => assert(verb.form(key),
      `${v.kana}: skip list refers to an unknown form "${key}"`));

    /* 拆成「詞幹 + 詞尾」之後拼回去一定要等於原形，
       拼圖玩法就是靠這個拆法出題的，拆錯等於出題錯 */
    verb.formsFor(v).forEach(f => {
      const sp = verb.split(v, f.key);
      assert(sp, `${v.kana} → ${f.label} cannot be split`);
      assert.strictEqual(sp.head + sp.tail, verb.conjugate(v, f.key),
        `${v.kana} → ${f.label}: head + tail must rebuild the whole form`);
    });
  });

  /* 每一種活用都要有動詞，否則某一關會開天窗 */
  ['godan', 'ichidan', 'suru', 'kuru'].forEach(type => {
    assert(verb.byType(type).length > 0, `No verbs registered for type ${type}`);
  });

  /* 九個五段詞尾都要被用到，不然會少一條規則 */
  ['う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'る'].forEach(col => {
    assert(verb.VERBS.some(v => v.type === 'godan' && v.col === col),
      `No godan verb covers the ${col} row`);
  });
}

/* =========================================================
   動詞玩法的出題機制
   題目是隨機生的，所以要在這裡釘死「每一題都必須是完整的」，
   不然很容易生出沒有正確選項、或是選項重複的題目。
   ========================================================= */
function validateVerbLevels() {
  const JPQ = loadData().JPQ;
  const verb = JPQ.verb;

  const allowedForms = ['te', 'nai', 'base', 'ta', 'masu'];
  const removedForms = ['masen', 'mashita', 'masendeshita', 'nakatta', 'mashimashou', 'masenka', 'tara',
    'dekita', 'you', 'meirei', 'kinshi', 'kate', 'ukerare', 'saseru', 'darou'];
  const vocab = JPQ.verbStudy.VOCAB;
  assert(Array.isArray(vocab) && vocab.length === 132, 'Practice must retain the 132 audited textbook verbs');
  assert.strictEqual(JPQ.VERB_LEVELS.length, allowedForms.length, 'Only the agreed beginner forms may be practiced');
  assert.deepStrictEqual(Array.from(JPQ.VERB_LEVELS.slice(0, 4), l => l.forms[0]), allowedForms.slice(0, 4),
    'Existing topic IDs must keep their meaning for saved progress and links');
  [5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19].forEach(no => {
    assert(!JPQ.VERB_LEVELS.some(level => level.no === no), `Out-of-scope legacy topic ${no} must not be reused`);
    assert.strictEqual(JPQ.verbStudy.configFor(`#/play/verb-quiz/${no}`), null,
      `Removed topic ${no} must not start a round through an old link`);
  });
  assert.deepStrictEqual(Array.from(JPQ.VERB_LEVELS, l => l.forms[0]).sort(), allowedForms.slice().sort());
  assert.deepStrictEqual(Array.from(JPQ.verbStudy.FORM_KEYS), allowedForms);
  removedForms.forEach(key => {
    assert.strictEqual(JPQ.verbGame.build({ forms: [key] }).length, 0, `Removed form ${key} must not create questions`);
    assert.strictEqual(JPQ.verbStudy.configFor(`#/play/verb-quiz/${key}`), null,
      `Removed form ${key} must not start a round through a direct link`);
  });
  assert.strictEqual(new Set(vocab.map(v => v.id || v.kana)).size, vocab.length, 'Vocabulary entries must not duplicate verbs');
  vocab.forEach(v => {
    assert([1, 2].includes(v.book), `${v.kana}: textbook volume must be 1 or 2`);
    assert(Number.isInteger(v.lesson) && v.lesson >= 1 && v.lesson <= 25, `${v.kana}: lesson must be 1–25`);
    assert.strictEqual(v.book, v.lesson <= 12 ? 1 : 2, `${v.kana}: textbook volume disagrees with the lesson`);
  });
  JPQ.VERB_LEVELS.forEach(level => {
    assert.strictEqual(level.forms.length, 1, 'Each practice must focus on just one form');
    assert.strictEqual(level.count, 10, 'Each practice must contain ten questions');
    vocab.filter(v => verb.supports(v, level.forms[0])).forEach(v => {
      const tip = JPQ.verbStudy.tip(v, level.forms[0]);
      assert(!/undefined|未然|連用|連体|音便|五段|サ変|カ変/.test(tip), 'Learner explanations must use beginner language');
      assert(tip.includes(verb.conjugate(v, level.forms[0])), 'The explanation must include the correct answer');
    });
  });
  assert(JPQ.verbStudy.tip(verb.byKana('まつ'), 'te').includes('「ちます」換成「って」'));
  assert(JPQ.verbStudy.tip(verb.byKana('かう'), 'nai').includes('「います」換成「わない」'));
  const page = fs.readFileSync(path.join(ROOT, 'conjugation.html'), 'utf8');
  ['verb-speed.js', 'verb-match.js', 'verb-scramble.js', '未然形', '連用形'].forEach(text =>
    assert(!page.includes(text), `Beginner page still contains ${text}`));

  JPQ.VERB_LEVELS.forEach(level => {
    assert(level.no > 0 && level.title && level.sub, `Level ${level.no} is missing copy`);
    assert.strictEqual(level.count, 10, `Level ${level.no} needs exactly ten questions`);
    level.forms.forEach(k => assert(verb.form(k),
      `Level ${level.no} refers to an unknown form "${k}"`));
    level.types.forEach(t => assert(['godan', 'ichidan', 'suru', 'kuru'].includes(t),
      `Level ${level.no} refers to an unknown type "${t}"`));

    /* 出三輪：每次都要湊得滿題數，而且題目本身要站得住 */
    for (let round = 0; round < 3; round++) {
      const qs = JPQ.verbGame.build(level);
      assert.strictEqual(qs.length, level.count,
        `Level ${level.no} only produced ${qs.length}/${level.count} questions`);

      const seen = new Set();
      qs.forEach(q => {
        assert(q.a, `Level ${level.no}: a question has no answer`);
        assert.strictEqual(q.opts.length, 2, `Level ${level.no}: needs exactly 2 distractors`);
        assert.strictEqual(new Set(q.opts).size, q.opts.length,
          `Level ${level.no}: duplicate options`);
        assert(q.opts.indexOf(q.a) === -1,
          `Level ${level.no}: "${q.a}" leaked into its own options`);
        q.opts.forEach(o => {
          assert(o && o !== q.a, `Level ${level.no}: empty or duplicate option`);
          assert(o.length >= 2, `Level ${level.no}: option "${o}" is too short to be readable`);
        });
        assert(verb.supports(q.verb, q.key),
          `Level ${level.no}: asked a form this verb does not have`);
        assert.strictEqual(q.a, verb.conjugate(q.verb, q.key),
          `Level ${level.no}: answer does not match the engine`);
        assert.strictEqual(q.from, verb.display(q.verb, q.key === 'masu' ? 'base' : 'masu'),
          'Questions should start from the familiar masu form unless asking for masu');

        assert(vocab.some(v => v.kana === q.verb.kana), `Level ${level.no}: ${q.verb.kana} is outside textbook vocabulary`);
        const identity = q.verb.id || q.verb.kana;
        assert(!seen.has(identity), `Level ${level.no}: repeated verb ${identity}`);
        seen.add(identity);
      });
    }
  });

  /* 快速搶答的總題庫 */
  const pool = JPQ.verbGame.poolAll();
  assert(pool.length > 100, `The shared beginner question pool is too small (${pool.length})`);
  const question = (kana, key) => pool.find(q => q.verb.kana === kana && q.key === key);
  [
    ['のむ', 'te', ['のんて', 'のみて']],
    ['かく', 'te', ['かいで', 'かきて']],
    ['たべる', 'te', ['たべって', 'たべいて']],
    ['のむ', 'ta', ['のんた', 'のみた']],
    ['かう', 'nai', ['かいない', 'かうない']]
  ].forEach(([kana, key, expected]) => {
    assert.deepStrictEqual(Array.from(question(kana, key).opts), expected,
      `${kana} ${key}: use plausible mistakes instead of unrelated conjugations`);
  });
  const endings = { te:/[てで]$/, ta:/[ただ]$/, masu:/ます$/, nai:/ない$/, base:/[うくぐすつぬぶむる]$/,
    dekita:/る$/, you:/う$/, kinshi:/な$/, kate:/ば$/, ukerare:/れる$/, saseru:/せる$/ };
  JPQ.VERB_LEVELS.forEach(level => {
    const key = level.forms[0];
    vocab.filter(v => verb.supports(v, key)).forEach(v => {
      const q = question(v.kana, key);
      assert(q, `${v.kana} ${key}: every supported beginner question must have distractors`);
      const prefix = v.type === 'suru' || v.type === 'kuru' ? v.kana.slice(0, -2) : v.kana.slice(0, -1);
      q.opts.forEach(o => {
        assert(o.startsWith(prefix), `${v.kana} ${key}: distractors must use this verb`);
        if (endings[key]) assert(endings[key].test(o), `${v.kana} ${key}: don't reveal the answer by its ending`);
        assert(o !== verb.conjugate(v, q.fromKey), `${v.kana} ${key}: do not offer the unchanged prompt as a distractor (${o})`);
      });
      if (v.type === 'ichidan' && key === 'dekita') assert(!q.opts.includes(v.kana.slice(0, -1) + 'れる'));
      if (v.type === 'ichidan' && key === 'meirei') assert(!q.opts.includes(v.kana.slice(0, -1) + 'よ'));
      if (v.type === 'suru' && key === 'meirei') assert(!q.opts.includes(v.kana.slice(0, -2) + 'せよ'));
    });
  });
  pool.forEach(q => {
    assert(allowedForms.includes(q.key), `Shared pool contains out-of-scope form ${q.key}`);
    assert(vocab.some(v => v.kana === q.verb.kana), `Shared pool contains out-of-scope verb ${q.verb.kana}`);
    q.opts.concat(q.a).forEach(kana => {
      const shown = verb.displayKana(q.verb, kana);
      assert.strictEqual(shown.replace(/[一-龯々〆〇]+\[([^\]]+)\]/g, '$1'), kana,
        'Adding kanji and furigana must preserve the answer kana');
    });
    assert(q.opts.length === 2 && q.opts.indexOf(q.a) === -1,
      `Speed pool has a malformed question for ${q.verb.kana} ${q.key}`);
  });
}

function validateSeoAssets() {
  const publicOrigin = 'https://nihongo-2-static.onrender.com';
  const pages = [
    ['index.html', `${publicOrigin}/`],
    ['particles.html', `${publicOrigin}/particles.html`],
    ['gojuon.html', `${publicOrigin}/gojuon.html`],
    ['conjugation.html', `${publicOrigin}/conjugation.html`],
    ['listening/index.html', `${publicOrigin}/listening/`],
    ['hiragana/index.html', `${publicOrigin}/hiragana/`]
  ];

  pages.forEach(([file, canonical]) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert(source.includes(`rel="canonical" href="${canonical}"`), `${file} is missing its canonical URL`);
    assert(source.includes('property="og:title"'), `${file} is missing Open Graph metadata`);
    const structuredData = source.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
    assert(structuredData, `${file} is missing structured data`);
    assert.doesNotThrow(() => JSON.parse(structuredData[1]), `${file} has invalid structured data`);
  });

  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assert(robots.includes(`Sitemap: ${publicOrigin}/sitemap.xml`));

  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  pages.forEach(([, url]) => assert(sitemap.includes(`<loc>${url}</loc>`), `Sitemap is missing ${url}`));
}

/* 用最小 DOM stub 載入遊戲檔，確認每款玩法都帶齊首頁卡片與 HUD 需要的欄位 */
function validateGameRegistration() {
  const noop = () => {};
  const element = () => new Proxy({
    dataset: {}, style: {}, children: [], innerHTML: '', textContent: '',
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, appendChild: noop,
    querySelector: () => null, querySelectorAll: () => []
  }, {
    get: (target, key) => (key in target ? target[key] : noop),
    set: (target, key, value) => { target[key] = value; return true; }
  });

  const sandbox = {
    console, setTimeout, clearTimeout, requestAnimationFrame: noop,
    addEventListener: noop,
    document: {
      addEventListener: noop, getElementById: element, querySelector: element,
      querySelectorAll: () => [], createElement: element, body: element()
    }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);

  ['core.js', 'kana-data.js', 'vocab-data.js', 'gojuon.js'].forEach(file => {
    const source = fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
    new vm.Script(source, { filename: file }).runInContext(context);
  });

  const games = context.JPQ.games;
  const names = Object.keys(games);
  ['kana-read', 'kana-write', 'kana-listen', 'kana-match'].forEach(name =>
    assert(games[name], `玩法 ${name} 沒有註冊`));

  names.forEach(name => {
    const game = games[name];
    assert(game.title, `${name} 缺少 title（HUD 與卡片都會用到）`);
    assert(typeof game.mount === 'function', `${name} 缺少 mount`);
    assert(typeof game.unmount === 'function', `${name} 缺少 unmount`);
    ['title', 'tag', 'desc', 'thumb'].forEach(field =>
      assert(game.card && game.card[field], `${name} 的卡片缺少 ${field}`));
  });

  /* 排行榜分頁必須認得每一款玩法 */
  const leaderboard = fs.readFileSync(path.join(ROOT, 'js', 'leaderboard.js'), 'utf8');
  names.forEach(name =>
    assert(leaderboard.includes(`'${name}'`), `排行榜設定缺少 ${name}`));
}

function validateStaticBuild() {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-static.mjs')], {
    cwd: ROOT, stdio: 'ignore'
  });
  ['index.html', 'particles.html', 'gojuon.html', 'conjugation.html',
    'robots.txt', 'sitemap.xml', 'google9c5c7b9e4d268263.html',
    path.join('css', 'style.css'), path.join('js', 'leaderboard.js')]
    .forEach(file => assert(fs.existsSync(path.join(ROOT, 'dist', file)), `Static build is missing ${file}`));
  ['server.js', 'render.yaml', 'package.json', 'tests', 'apps', 'node_modules']
    .forEach(file => assert(!fs.existsSync(path.join(ROOT, 'dist', file)), `Static build exposed private file ${file}`));

  for (const file of ['index.html', 'particles.html', 'gojuon.html', 'conjugation.html', 'hiragana/index.html']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.strictEqual(fs.readFileSync(path.join(ROOT, 'dist', file), 'utf8'), source,
      `${file}: direct hosting and static hosting must receive the same asset versions`);
    const assets = Array.from(source.matchAll(/(?:src|href)="((?:js|css)\/[^"?#]+)(\?[^"#]+)?"/g));
    assert(assets.some(m => m[1] === (file.startsWith('hiragana/') ? 'js/app.js' : 'js/catalog.js')),
      `${file}: game entry must be loaded`);
    assets.forEach(([, asset, search]) => {
      const assetPath = path.join(ROOT, path.dirname(file), asset);
      const content = fs.readFileSync(assetPath, 'utf8').replace(/\r\n/g, '\n');
      const expected = createHash('sha256').update(content).digest('hex').slice(0, 12);
      assert.strictEqual(new URLSearchParams(search).get('v'), expected,
        `${file}: ${asset} must use its current content version instead of a stale cached file`);
    });
  }
  const entries = ['index.html', 'particles.html', 'gojuon.html', 'conjugation.html', 'hiragana/index.html'];
  const firstBuild = entries.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8'));
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-static.mjs')], {cwd: ROOT, stdio: 'ignore'});
  assert.deepStrictEqual(entries.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')), firstBuild,
    'Repeated static builds must keep asset versions stable');

  const game = fs.readFileSync(path.join(ROOT, 'dist/listening/index.html'), 'utf8');
  const assets = Array.from(game.matchAll(/(?:src|href)="(\.\/assets\/[^"#?]+)"/g), match => match[1]);
  assert(assets.length >= 2, 'Listening game needs both built JavaScript and styles');
  assets.forEach(file => assert(fs.existsSync(path.join(ROOT, 'dist/listening', file)), `Listening build is missing ${file}`));
  ['sw.js', 'manifest.webmanifest', 'DATA_SOURCE.md', 'data/vocabulary.sample.json', 'icons/icon-192.png'].forEach(file =>
    assert(fs.existsSync(path.join(ROOT, 'dist/listening', file)), `Listening build is missing ${file}`));
  assert(!game.includes('/src/main.tsx'), 'Production listening page must load compiled assets');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/listening/manifest.webmanifest'), 'utf8'));
  assert.strictEqual(manifest.scope, './', 'Offline mode must stay within the listening game');
  const adventure = fs.readFileSync(path.join(ROOT, 'dist/hiragana/index.html'), 'utf8');
  assert(adventure.includes('../listening/'), 'The new game must preserve the listening navigation entry');
  assert(adventure.includes('五十音大冒險'));
  assert(!adventure.includes('fonts.googleapis.com'), 'The new game must use local fonts');
  ['js/utils.js', 'js/data.js', 'js/matching.js', 'js/memory.js', 'js/sentence.js', 'js/app.js', 'css/style.css', 'css/site-theme.css']
    .forEach(file => assert(fs.existsSync(path.join(ROOT, 'dist/hiragana', file)), `Adventure build is missing ${file}`));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(err => err ? reject(err) : resolve(port));
    });
  });
}

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port, path: pathname,
      method: options.method || 'GET', headers: options.headers || {}
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.once('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
    try {
      const result = await request(port, '/api/health');
      if (result.status === 200) return;
    } catch (error) {
      // The server may still be binding the port.
    }
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error('Timed out waiting for the test server');
}

async function validateServer() {
  const port = await freePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihongo-2-test-'));
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js'), String(port)], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR: tempDir, DB_FILE: path.join(tempDir, 'leaderboard.json') },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });

  try {
    await waitForServer(port, child);

    let result = await request(port, '/api/leaderboard', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://nihongo-2-static.onrender.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    assert.strictEqual(result.status, 204, 'Cross-origin leaderboard preflight must succeed');
    assert.strictEqual(result.headers['access-control-allow-origin'], '*');
    assert(result.headers['access-control-allow-methods'].includes('POST'));

    const post = payload => request(port, '/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    result = await post({ game: 'speed', name: 'Alice', score: 100, detail: 'high score' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(JSON.parse(result.body).improved, true);

    result = await post({ game: 'speed', name: 'Alice', score: 80, detail: 'lower score' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(JSON.parse(result.body).improved, false);

    result = await request(port, '/api/leaderboard');
    const board = JSON.parse(result.body).boards.speed;
    assert.strictEqual(board[0].score, 100, 'A lower score must not replace the personal best');
    assert.strictEqual(board[0].detail, 'high score', 'A lower score must not replace best-score details');

    result = await post({ game: 'unknown-game', name: 'Alice', score: 1 });
    assert.strictEqual(result.status, 400, 'Unknown games must be rejected');

    /* 排行榜分頁的分鐘數、伺服器白名單、LB_GAMES 三邊要一致。
       只要少加一個 key，那款遊戲登記排行榜時就會默默收到 400。 */
    const lbSource = fs.readFileSync(path.join(ROOT, 'js', 'leaderboard.js'), 'utf8');
    const lbBlock = lbSource.match(/JPQ\.LB_GAMES\s*=\s*\{([\s\S]*?)\n\}/);
    assert(lbBlock, 'Could not find JPQ.LB_GAMES in js/leaderboard.js');
    const lbKeys = Array.from(lbBlock[1].matchAll(/^\s*'?([\w-]+)'?\s*:\s*\{/gm))
      .map(m => m[1]);
    assert(lbKeys.length >= 10, `LB_GAMES only listed ${lbKeys.length} games`);

    for (const game of lbKeys) {
      const posted = await post({ game, name: 'Bob', score: 7, detail: 'sync check' });
      assert.strictEqual(posted.status, 200,
        `Game "${game}" is listed in LB_GAMES but the server rejects it`);
    }

    result = await request(port, '/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'speed', name: 'A', score: 1, detail: 'x'.repeat(5000) })
    });
    assert.strictEqual(result.status, 413, 'Oversized requests must receive HTTP 413');

    result = await request(port, '/server.js');
    assert.strictEqual(result.status, 403, 'Private source files must not be served');

    result = await request(port, '/apps/listening/src/App.tsx');
    assert.strictEqual(result.status, 403, 'Imported development source must not be served');
    result = await request(port, '/listening');
    assert.strictEqual(result.status, 302, 'Directory entry must redirect to a relative-assets-safe URL');
    assert.strictEqual(result.headers.location, '/listening/index.html');
    result = await request(port, '/listening/index.html');
    assert.strictEqual(result.status, 200);
    assert(result.body.includes('聞いボード'));
    result = await request(port, '/listening/manifest.webmanifest');
    assert.strictEqual(result.status, 200);
    assert(result.headers['content-type'].startsWith('application/manifest+json'));
    result = await request(port, '/listening/data/vocabulary.sample.json');
    assert.strictEqual(result.status, 200, 'Public vocabulary sample must not be blocked as private leaderboard data');
    result = await request(port, '/hiragana');
    assert.strictEqual(result.status, 302);
    assert.strictEqual(result.headers.location, '/hiragana/index.html');
    result = await request(port, '/hiragana/index.html');
    assert.strictEqual(result.status, 200);
    assert(result.body.includes('五十音大冒險'));

    result = await request(port, '/robots.txt');
    assert.strictEqual(result.status, 200, 'robots.txt must be publicly available');
    assert(result.body.includes('/sitemap.xml'));

    result = await request(port, '/sitemap.xml');
    assert.strictEqual(result.status, 200, 'sitemap.xml must be publicly available');
    assert(result.body.includes('<urlset'));

    result = await request(port, '/google9c5c7b9e4d268263.html');
    assert.strictEqual(result.status, 200, 'Google ownership verification file must be publicly available');
    assert.strictEqual(result.body.trim(), 'google-site-verification: google9c5c7b9e4d268263.html');

    result = await request(port, '/%3Cscript%3E');
    assert.strictEqual(result.status, 404);
    assert(!result.body.includes('<script>'), 'The 404 page must escape the requested path');
    assert(result.body.includes('&lt;script&gt;'));
  } finally {
    child.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  if (stderr) throw new Error(stderr);
}

/* =========================================================
   動詞玩法的畫面
   用一個剛好夠用的假 DOM 載入實際公開的練習頁面。
   規則引擎測得過不代表畫得出來，所以這一段專門抓 render 的錯誤。
   ========================================================= */
function validateVerbUI() {
  const stubEl = () => ({
    id: '', innerHTML: '', textContent: '', value: '', disabled: false,
    dataset: {}, style: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {},
    focus() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector(sel) { return nodes[sel] || (nodes[sel] = stubEl()); },
    querySelectorAll() { return []; }
  });

  const nodes = {};
  nodes['#vbStudyForm'] = Object.assign(stubEl(), { value: 'te' });
  nodes['#vbStudyBook'] = Object.assign(stubEl(), { value: 'all' });
  const location = { hash: '#/' };
  const document = {
    body: stubEl(), head: stubEl(), createElement: stubEl, addEventListener() {},
    querySelector(sel) { return nodes[sel] || (nodes[sel] = stubEl()); },
    querySelectorAll() { return []; }
  };

  const sandbox = {
    document, console, location,
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    addEventListener() {}, scrollTo() {}, navigator: { userAgent: 'node' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    speechSynthesis: undefined, innerWidth: 1200, innerHeight: 800
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  ['core.js', 'catalog.js', 'site.js', 'learn.js', 'verb-data.js', 'verb-vocab.js', 'verb-beginner.js', 'verb-levels.js',
   'verb-quiz.js',
   'verb-sheet.js', 'leaderboard.js', 'home.js'
  ].forEach(file => {
    const source = fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
    new vm.Script(source, { filename: file }).runInContext(context);
  });

  const JPQ = context.JPQ;
  JPQ.store.load();
  JPQ.store.save = () => {};
  JPQ.hud.init();
  JPQ.fx.boot = () => {};
  JPQ.fx.size = () => {};
  JPQ.fx.burst = () => {};
  JPQ.fx.center = () => {};

  /* 公開的動詞練習要帶齊首頁卡片欄位 */
  ['verb-quiz'].forEach(name => {
    assert(JPQ.games[name], `Game "${name}" was never registered`);
    const card = JPQ.games[name].card || {};
    assert(card.title && card.desc && card.tag && card.color && card.icon && card.thumb,
      `Game "${name}" has an incomplete card (the catalog would render a blank)`);
  });

  /* 速查表要畫得 出來，而且不能是空的 */
  JPQ.verbSheet.render();
  const sheet = nodes['#verbSheet'].innerHTML + nodes['#vbStudyExamples'].innerHTML;
  assert(sheet.length > 1000, `Cheat sheet rendered only ${sheet.length} characters`);
  ['想查哪一種變化', '第Ⅰ類', '第Ⅱ類', '第Ⅲ類', '查看收錄字彙'].forEach(text =>
    assert(sheet.includes(text), `Cheat sheet is missing the "${text}" section`));
  /* 表上每個動詞都要真的排得出來，否則會出現空白格 */
  assert(!/undefined|NaN|\[object/.test(sheet), 'Cheat sheet contains undefined/NaN text');

  /* 每款玩法掛上去都要畫出東西 */
  Object.keys(JPQ.games).forEach(name => {
    JPQ.go('#/play/' + name);
    JPQ.router();
    const html = nodes['#stage'].innerHTML;
    assert(html.length > 200, `Game "${name}" rendered almost nothing (${html.length} chars)`);
    assert(!/undefined|NaN|\[object/.test(html), `Game "${name}" rendered undefined/NaN text`);
  });

  /* 設定頁可指定冊別與變化，所有選項限於初級範圍。 */
  JPQ.go('#/play/verb-quiz');
  JPQ.router();
  const settings = fs.readFileSync(path.join(ROOT, 'conjugation.html'), 'utf8');
  ['verbPracticeForm', 'verbBook', 'verbForm', 'verbStart'].forEach(id =>
    assert(settings.includes(`id="${id}"`), `Practice settings are missing ${id}`));
  assert(nodes['#stage'].innerHTML.includes('id="verbChoose"'), 'Invalid practice links need a way back to settings');
  const choices = nodes['#verbSheet'].innerHTML;
  JPQ.VERB_LEVELS.forEach(level =>
    assert(choices.includes(`value="${level.forms[0]}"`), `Missing beginner form option ${level.forms[0]}`));
  ['masen', 'mashita', 'masendeshita', 'nakatta', 'mashimashou', 'masenka', 'tara',
    'dekita', 'you', 'meirei', 'kinshi', 'kate', 'ukerare', 'saseru'].forEach(key =>
    assert(!choices.includes(`value="${key}"`), `Out-of-scope form ${key} appeared in settings`));

  /* 遊戲卡片的縮圖樣式必須在 site.js 的表裡，否則首頁會畫不出縮圖 */
  const siteSource = fs.readFileSync(path.join(ROOT, 'js', 'site.js'), 'utf8');
  ['verb-quiz'].forEach(name => {
    const thumb = JPQ.games[name].card.thumb;
    assert(new RegExp('\\b' + thumb + ':').test(siteSource),
      `Thumbnail "${thumb}" (used by ${name}) is missing from THUMBS in js/site.js`);
  });
}

function validateLearningRecords() {
  const sandbox = { document:{addEventListener(){}}, addEventListener(){},
    localStorage:{getItem(){return null;},setItem(){}}, console };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  ['core.js','learn.js'].forEach(file => new vm.Script(
    fs.readFileSync(path.join(ROOT,'js',file),'utf8'),{filename:file}).runInContext(context));
  const JPQ = context.JPQ;
  assert(JPQ.learn.bodyHTML().includes('從一小步開始'));
  const now = Date.now();
  JPQ.store.data = { levels:{'verb-study-v2-2':3}, records:{speed:100}, stats:{
    runs:[{game:'quiz',at:now-3000,total:10,right:8},
      {game:'verb-quiz',at:now-2000,total:6,right:3},
      {game:'kana-listen',at:now-1000,total:4,right:4},
      {game:'verb-quiz',at:now,total:6,right:6}],
    acc:{'は':{correct:8,total:10},'形:te':{correct:1,total:6},'形:nai':{correct:3,total:3}},days:[]
  }};
  const all = JPQ.learn.summary();
  assert.strictEqual(all.total,26);
  assert.strictEqual(all.right,21);
  assert.strictEqual(all.rate,81,'Calculate weighted accuracy instead of averaging session rates');
  assert.strictEqual(JPQ.learn.summary('verbs').total,12);
  assert.strictEqual(JPQ.learn.summary('verbs').rate,75);
  assert.strictEqual(JPQ.learn.summary('particles').total,10);
  assert.strictEqual(JPQ.learn.summary('kana').rate,100);
  assert.strictEqual(JPQ.learn.summary('verbs').recent.length,2);
  assert.strictEqual(all.recent[0].at,now,'Recent results should be newest first');
  const verbs = JPQ.learn.bodyHTML('verbs');
  assert(verbs.includes('て形') && verbs.includes('ない形'));
  assert(verbs.includes('再累積幾題'),'Small samples must not be called mastered');
  assert(verbs.includes('conjugation.html#/play/verb-quiz/2'));
  assert(!verbs.includes('主題 · 答對'),'Verb filter must not show particle performance');
  ['all','particles','verbs','kana'].forEach(scope =>
    assert(!/undefined|NaN/.test(JPQ.learn.bodyHTML(scope))));
  JPQ.stats.reset();
  assert.strictEqual(JPQ.store.data.levels['verb-study-v2-2'],3);
  assert.strictEqual(JPQ.store.data.records.speed,100);
  assert(JPQ.learn.bodyHTML().includes('從一小步開始'));
}

async function main() {
  compileJavaScript();
  validateLearningData();
  validateVerbData();
  validateVerbLevels();
  validateVerbUI();
  validateLearningRecords();
  validateGameRegistration();
  validateSeoAssets();
  validateStaticBuild();
  await validateServer();
  console.log('Smoke tests passed.');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
