/* ==========================================================================
   data.js — 五十音資料表 + 分段關卡 + 由簡入繁短句題庫
   ========================================================================== */
(function (global) {
  'use strict';

  var BASIC_ROWS = ['あ行', 'か行', 'さ行', 'た行', 'な行', 'は行', 'ま行', 'や行', 'ら行', 'わ行'];

  /* ------------------------------------------------------------ 五十音表
     k = 平假名, r = 羅馬字（Hepburn）, row = 五十音行
  ---------------------------------------------------------------------- */
  var GOJUON = [
    { row: 'あ行', k: 'あ', r: 'a' }, { row: 'あ行', k: 'い', r: 'i' }, { row: 'あ行', k: 'う', r: 'u' },
    { row: 'あ行', k: 'え', r: 'e' }, { row: 'あ行', k: 'お', r: 'o' },

    { row: 'か行', k: 'か', r: 'ka' }, { row: 'か行', k: 'き', r: 'ki' }, { row: 'か行', k: 'く', r: 'ku' },
    { row: 'か行', k: 'け', r: 'ke' }, { row: 'か行', k: 'こ', r: 'ko' },

    { row: 'さ行', k: 'さ', r: 'sa' }, { row: 'さ行', k: 'し', r: 'shi' }, { row: 'さ行', k: 'す', r: 'su' },
    { row: 'さ行', k: 'せ', r: 'se' }, { row: 'さ行', k: 'そ', r: 'so' },

    { row: 'た行', k: 'た', r: 'ta' }, { row: 'た行', k: 'ち', r: 'chi' }, { row: 'た行', k: 'つ', r: 'tsu' },
    { row: 'た行', k: 'て', r: 'te' }, { row: 'た行', k: 'と', r: 'to' },

    { row: 'な行', k: 'な', r: 'na' }, { row: 'な行', k: 'に', r: 'ni' }, { row: 'な行', k: 'ぬ', r: 'nu' },
    { row: 'な行', k: 'ね', r: 'ne' }, { row: 'な行', k: 'の', r: 'no' },

    { row: 'は行', k: 'は', r: 'ha' }, { row: 'は行', k: 'ひ', r: 'hi' }, { row: 'は行', k: 'ふ', r: 'fu' },
    { row: 'は行', k: 'へ', r: 'he' }, { row: 'は行', k: 'ほ', r: 'ho' },

    { row: 'ま行', k: 'ま', r: 'ma' }, { row: 'ま行', k: 'み', r: 'mi' }, { row: 'ま行', k: 'む', r: 'mu' },
    { row: 'ま行', k: 'め', r: 'me' }, { row: 'ま行', k: 'も', r: 'mo' },

    { row: 'や行', k: 'や', r: 'ya' }, { row: 'や行', k: 'ゆ', r: 'yu' }, { row: 'や行', k: 'よ', r: 'yo' },

    { row: 'ら行', k: 'ら', r: 'ra' }, { row: 'ら行', k: 'り', r: 'ri' }, { row: 'ら行', k: 'る', r: 'ru' },
    { row: 'ら行', k: 'れ', r: 're' }, { row: 'ら行', k: 'ろ', r: 'ro' },

    { row: 'わ行', k: 'わ', r: 'wa' }, { row: 'わ行', k: 'を', r: 'wo' }, { row: 'わ行', k: 'ん', r: 'n' },

    /* 濁音 */
    { row: '濁音', k: 'が', r: 'ga' }, { row: '濁音', k: 'ぎ', r: 'gi' }, { row: '濁音', k: 'ぐ', r: 'gu' },
    { row: '濁音', k: 'げ', r: 'ge' }, { row: '濁音', k: 'ご', r: 'go' },
    { row: '濁音', k: 'ざ', r: 'za' }, { row: '濁音', k: 'じ', r: 'ji' }, { row: '濁音', k: 'ず', r: 'zu' },
    { row: '濁音', k: 'ぜ', r: 'ze' }, { row: '濁音', k: 'ぞ', r: 'zo' },
    { row: '濁音', k: 'だ', r: 'da' }, { row: '濁音', k: 'ぢ', r: 'ji' }, { row: '濁音', k: 'づ', r: 'zu' },
    { row: '濁音', k: 'で', r: 'de' }, { row: '濁音', k: 'ど', r: 'do' },
    { row: '濁音', k: 'ば', r: 'ba' }, { row: '濁音', k: 'び', r: 'bi' }, { row: '濁音', k: 'ぶ', r: 'bu' },
    { row: '濁音', k: 'べ', r: 'be' }, { row: '濁音', k: 'ぼ', r: 'bo' },

    /* 半濁音 */
    { row: '半濁音', k: 'ぱ', r: 'pa' }, { row: '半濁音', k: 'ぴ', r: 'pi' }, { row: '半濁音', k: 'ぷ', r: 'pu' },
    { row: '半濁音', k: 'ぺ', r: 'pe' }, { row: '半濁音', k: 'ぽ', r: 'po' },

    /* 拗音（小書き） */
    { row: '拗音', k: 'ゃ', r: 'ya' }, { row: '拗音', k: 'ゅ', r: 'yu' }, { row: '拗音', k: 'ょ', r: 'yo' }
  ];

  /** 連連看 / 翻牌記憶用字庫：基礎 46 音（羅馬字不重複，無濁音歧義） */
  var BASIC_POOL = GOJUON
    .filter(function (x) { return BASIC_ROWS.indexOf(x.row) >= 0; })
    .map(function (x) { return { k: x.k, r: x.r, row: x.row }; });

  var KANA_POOL = GOJUON.map(function (x) { return x.k; });
  var ROMAJI_POOL = BASIC_POOL.map(function (x) { return x.r; });

  /* ============================================================ 初階關卡
     「分段循序漸進」
     1. 基礎關卡：依五十音行分成 5 關，每關切成「每批 5 組」，
        消除完一批自動載入下一批。
     2. 最後總複習：46 個基礎平假名分成 3 個大輪次（15 / 15 / 16），
        每輪採用「滑動視窗」——畫面固定 5 組，連對消除後自動補上下一組。
  ---------------------------------------------------------------------- */
  var BATCH_SIZE = 5;
  var WINDOW_SIZE = 5;

  var MATCHING_STAGES = [
    { id: 1, name: '第一關', sub: 'あ行・か行', rows: ['あ行', 'か行'], tone: '入門', mode: 'batch' },
    { id: 2, name: '第二關', sub: 'さ行・た行', rows: ['さ行', 'た行'], tone: '基礎', mode: 'batch' },
    { id: 3, name: '第三關', sub: 'な行・は行', rows: ['な行', 'は行'], tone: '基礎', mode: 'batch' },
    { id: 4, name: '第四關', sub: 'ま行・や行', rows: ['ま行', 'や行'], tone: '進階', mode: 'batch' },
    { id: 5, name: '第五關', sub: 'ら行・わ行', rows: ['ら行', 'わ行'], tone: '總複習', mode: 'batch' },
    { id: 6, name: '總複習', sub: '五十音全測驗', rows: BASIC_ROWS, tone: '全測驗', mode: 'window' }
  ];

  /** 總複習：46 個平假名 → 3 個大輪次（15 / 15 / 16） */
  var FINAL_ROUNDS = [15, 15, 16];

  /** 把某關的假名切成每批 5 組（基礎關卡用） */
  function buildBatches(stage) {
    var list = U_shuffle(BASIC_POOL.filter(function (x) {
      return stage.rows.indexOf(x.row) >= 0;
    }));
    var out = [];
    for (var i = 0; i < list.length; i += BATCH_SIZE) out.push(list.slice(i, i + BATCH_SIZE));
    return out;
  }

  /**
   * 總複習：把 46 個平假名依 15 / 15 / 16 切成 3 輪。
   * 回傳 [{ name, total, kana }]；三輪的 kana 串起來就是洗牌後的 46 音，
   * 供「滑動視窗」使用單一連續佇列（畫面固定 5 組、連對後補上下一組）。
   */
  function buildFinalRounds() {
    var all = U_shuffle(BASIC_POOL.slice());
    var rounds = [];
    var cursor = 0;
    var ends = [];
    FINAL_ROUNDS.forEach(function (n, i) {
      rounds.push({
        index: i,
        name: '第 ' + (i + 1) + ' 輪',
        total: n,
        start: cursor,
        end: cursor + n,
        kana: all.slice(cursor, cursor + n)
      });
      cursor += n;
      ends.push(cursor);
    });
    rounds.total = all;
    rounds.ends = ends;
    return rounds;
  }

  // 內部用的洗牌（避免依賴 utils 的載入順序）
  function U_shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ================================================ 高階：由簡入繁短句題庫
     tier 1 單字・短語（5 題）
     tier 2 基礎短句（5 題）
     tier 3 完整句子（5 題）

     syll  : 平假名音節（小書き拗音、促音併為一個單位，如 きょう / って）
     romaji: 與 syll 一一對應的羅馬字
     ※ 助詞「は」依羅馬字／輸入法規範寫作 ha（實際發音為 wa），
       避免初學者把 は 誤認為 わ。
  ---------------------------------------------------------------------- */
  function S(tier, kana, syll, romaji, zh, note) {
    return { tier: tier, kana: kana, syll: syll, romaji: romaji, zh: zh, note: note };
  }

  var TIER_LABEL = {
    1: { text: '單字・短語', badge: 'badge--matcha' },
    2: { text: '基礎短句', badge: 'badge--indigo' },
    3: { text: '完整句子', badge: 'badge--sun' }
  };

  var SENTENCES = [
    /* ---- 第一階：單字・短語 ---- */
    S(1, 'すし', ['す', 'し'], ['su', 'shi'], '壽司。', '單字'),
    S(1, 'ねこ', ['ね', 'こ'], ['ne', 'ko'], '貓。', '單字'),
    S(1, 'さかな', ['さ', 'か', 'な'], ['sa', 'ka', 'na'], '魚。', '單字'),
    S(1, 'ありがとう', ['あ', 'り', 'が', 'とう'], ['a', 'ri', 'ga', 'tou'], '謝謝。', '單字'),
    S(1, 'がっこう', ['がっこう'], ['gakkou'], '學校。', '單字'),

    /* ---- 第二階：基礎短句 ---- */
    S(2, 'おはよう', ['お', 'は', 'よう'], ['o', 'ha', 'you'], '早安。', '招呼語'),
    S(2, 'すみません', ['す', 'み', 'ま', 'せん'], ['su', 'mi', 'ma', 'sen'], '對不起。', '招呼語'),
    S(2, 'こんにちは', ['こ', 'ん', 'に', 'ち', 'は'], ['ko', 'n', 'ni', 'chi', 'ha'], '你好。', '招呼語'),
    S(2, 'いただきます', ['い', 'た', 'だ', 'き', 'ま', 'す'], ['i', 'ta', 'da', 'ki', 'ma', 'su'], '我要開動了。', '用餐'),
    S(2, 'おねがいします', ['お', 'ね', 'が', 'い', 'し', 'ま', 'す'], ['o', 'ne', 'ga', 'i', 'shi', 'ma', 'su'], '拜託了。', '請求'),

    /* ---- 第三階：完整句子 ---- */
    S(3, 'わたしはがくせいです',
      ['わ', 'た', 'し', 'は', 'が', 'く', 'せ', 'い', 'で', 'す'],
      ['wa', 'ta', 'shi', 'ha', 'ga', 'ku', 'se', 'i', 'de', 'su'],
      '我是學生。', '自我介紹'),
    S(3, 'にほんごをべんきょうしています',
      ['に', 'ほ', 'ん', 'ご', 'を', 'べ', 'ん', 'きょう', 'し', 'て', 'い', 'ま', 'す'],
      ['ni', 'ho', 'n', 'go', 'o', 'be', 'n', 'kyo', 'shi', 'te', 'i', 'ma', 'su'],
      '我正在學日語。', '語言學習'),
    S(3, 'みずをください',
      ['み', 'ず', 'を', 'く', 'だ', 'さ', 'い'],
      ['mi', 'zu', 'o', 'ku', 'da', 'sa', 'i'],
      '請給我水。', '餐廳點餐'),
    S(3, 'いまなんじですか',
      ['い', 'ま', 'な', 'ん', 'じ', 'で', 'す', 'か'],
      ['i', 'ma', 'na', 'n', 'ji', 'de', 'su', 'ka'],
      '現在幾點？', '詢問時間'),
    S(3, 'としょかんにいきました',
      ['と', 'しょ', 'か', 'ん', 'に', 'い', 'き', 'ま', 'し', 'た'],
      ['to', 'sho', 'ka', 'n', 'ni', 'i', 'ki', 'ma', 'shi', 'ta'],
      '我去了圖書館。', '場所')
  ];

  /** 模式 A 的候選字庫：基本 46 音 + 拗音 / 促音 / 常見詞尾 */
  var SYLL_EXTRA = []
    .concat(['きゃ', 'きゅ', 'きょ', 'しゃ', 'しゅ', 'しょ', 'ちゃ', 'ちゅ', 'ちょ',
             'にゃ', 'にゅ', 'にょ', 'ひゃ', 'ひゅ', 'ひょ', 'みゃ', 'みゅ', 'みょ',
             'りゃ', 'りゅ', 'りょ'])
    .concat(['てぃ', 'でぃ', 'とぅ', 'ふぁ', 'ふぃ', 'ふぇ', 'ふぉ'])
    .concat(['とう', 'よう', 'せん', 'さん', 'たん', 'でん', 'ぼん', 'ぽん', 'まん',
             'ほん', 'じかん', 'にち', 'ひる', 'ごご']);

  var SYLL_POOL = (function () {
    var seen = {}, out = [];
    BASIC_POOL.map(function (x) { return x.k; })
      .concat(SYLL_EXTRA)
      .forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } });
    SENTENCES.forEach(function (s) {
      s.syll.forEach(function (y) { if (!seen[y]) { seen[y] = 1; out.push(y); } });
    });
    return out;
  })();

  /* ------------------------------------------------------- 讀音等價
     同一讀音可能對應多種假名寫法（わ/は、を/お、じ/ぢ …）。
     填空檢核時只要讀音相同就視為正確，避免初學者因寫法差異被扣分。
  ---------------------------------------------------------------------- */
  var EQUIV_GROUPS = [
    ['わ', 'は'],                 // wa / ha
    ['を', 'お'],                 // o
    ['じ', 'ぢ'],                 // ji
    ['ず', 'づ']                  // zu
  ];

  function readingsOf(kanaList) {
    var out = [];
    kanaList.forEach(function (k) {
      var hit = GOJUON.filter(function (x) { return x.k === k; })[0];
      var r = hit ? hit.r : k;
      if (out.indexOf(r) < 0) out.push(r);
    });
    return out;
  }

  var EQUIV_BY_KANA = {};    // kana   → 同讀音的羅馬字
  var EQUIV_BY_ROMAJI = {};  // romaji → 同義的羅馬字

  EQUIV_GROUPS.forEach(function (grp) {
    var romaji = readingsOf(grp);
    grp.forEach(function (k) { EQUIV_BY_KANA[k] = romaji; });
    romaji.forEach(function (r) { EQUIV_BY_ROMAJI[r] = romaji; });
  });

  /** 「は」的特殊註記：發音 wa，拼音寫作 ha */
  var HA_NOTE = 'は 實際發音為 wa，但羅馬字／輸入法拼音寫作 ha';

  /* ================================================ 開朗結束語音（完成關卡時播放）
     tags 對應觸發情境，由 Utils.praise() 依情境隨機挑選。
  ---------------------------------------------------------------------- */
  var PRAISE = [
    { ja: 'お疲れ様でした！完璧ですね！', zh: '辛苦了！太完美了！', tags: ['stage', 'batch'] },
    { ja: '素晴らしいです！その調子！', zh: '太棒了！就是這個節奏！', tags: ['stage', 'batch', 'pair', 'answer'] },
    { ja: 'よくできました！すごいすごい！', zh: '做得很好！好厲害好厲害！', tags: ['batch', 'pair', 'answer'] },
    { ja: '大成功！次もがんばりましょう！', zh: '大成功！下一關也一起加油吧！', tags: ['stage', 'batch'] }
  ];

  /* 各模式專屬的開朗動力標語（以日語為主、輔以中文說明） */
  var MOTIVATION = {
    hero: "一歩ずつ前へ！焦らず少しずつ、毎日成長しよう！",
    menu: "楽しく五十音をマスターしよう！",
    matching: "一歩ずつ前へ！楽しく五十音をマスターしよう！",
    memory: "記憶力を試そう！めくって楽しくアタマの運動！",
    sentence: "言葉をつなごう！日本語のフレーズを完成させよう！",
    footer: "焦らず少しずつ、毎日成長しよう！",
    finalStage: "ついにここまで来ました！最後の総復習に挑戦！"
  };

  /* --------------------------------------------------------- 對外 API */
  global.KanaData = {
    GOJUON: GOJUON,
    BASIC_POOL: BASIC_POOL,
    KANA_POOL: KANA_POOL,
    ROMAJI_POOL: ROMAJI_POOL,
    SYLL_POOL: SYLL_POOL,
    SENTENCES: SENTENCES,

    BATCH_SIZE: BATCH_SIZE,
    WINDOW_SIZE: WINDOW_SIZE,
    MATCHING_STAGES: MATCHING_STAGES,
    FINAL_ROUNDS: FINAL_ROUNDS,
    buildBatches: buildBatches,
    buildFinalRounds: buildFinalRounds,

    TIER_LABEL: TIER_LABEL,
    HA_NOTE: HA_NOTE,
    PRAISE: PRAISE,
    MOTIVATION: MOTIVATION,

    /** 依讀音找出該音所有假名寫法（i → い / に / き） */
    variantsOf: function (romaji) {
      return GOJUON.filter(function (x) { return x.r === romaji; }).map(function (x) { return x.k; });
    },
    romajiOf: function (kana) {
      var hit = GOJUON.filter(function (x) { return x.k === kana; })[0];
      return hit ? hit.r : '';
    },

    /** 假名讀音等價（は / わ 視為同音） */
    kanaEquivalent: function (a, b) {
      if (a === b) return true;
      var g = EQUIV_BY_KANA[a];
      return !!g && g.indexOf(readingsOf([b])[0]) >= 0;
    },
    /** 羅馬字讀音等價（wa / ha 視為同音） */
    romajiEquivalent: function (a, b) {
      if (a === b) return true;
      var g = EQUIV_BY_ROMAJI[a];
      return !!g && g.indexOf(b) >= 0;
    },

/** 進階：翻牌記憶網格選項
     奇數網格（3/5/7）：多一格萬用卡或留白
     偶數網格（4/6）：全部成對，不需要萬用卡
  ---------------------------------------------------------------------- */
/* 5×5 以上會先亮牌 7 秒讓玩家預覽位置 */
  MEMORY_SIZES: [
    { size: 3, pairs: 4, label: '3 × 3', desc: '4 組・萬用卡', tone: '入門', preview: false, previewSec: 7 },
    { size: 4, pairs: 8, label: '4 × 4', desc: '8 組配對', tone: '初級', preview: false, previewSec: 7 },
    { size: 5, pairs: 12, label: '5 × 5', desc: '12 組・萬用卡', tone: '中級', preview: true, previewSec: 7 },
    { size: 6, pairs: 18, label: '6 × 6', desc: '18 組配對', tone: '挑戰', preview: true, previewSec: 7 },
    { size: 7, pairs: 24, label: '7 × 7', desc: '24 組・萬用卡', tone: '高手', preview: true, previewSec: 7 }
  ],

    /* 僅保存遊玩進度（關卡解鎖），不保存任何分數紀錄 */
    MATCHING_UNLOCK_KEY: 'jpk.matching.unlock'
  };
})(window);
