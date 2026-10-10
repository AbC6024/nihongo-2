/* =========================================================
   動詞活用 — 關卡與題庫
   ------------------------------------------------------------
   題目不是一條一條手寫的，而是從 verb-data.js 的規則引擎
   隨機生出來；規則與資料的正確性由固定答案測試檢查。
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ = global.JPQ || {};
  const verb = JPQ.verb;

  /* ---------------- 關卡 ----------------
     每關指定：可以出哪些活用形、只能出哪些種類的動詞、抽幾題。
     forms 用 form key，寫 null 表示不限。                        */
  const LEVELS = [
    {
      no: 1, title: '一段動詞', sub: '只有一列，接什麼就變什麼',
      forms: ['base', 'te', 'ta', 'tai', 'masu', 'masen', 'mashita'],
      types: ['ichidan'], count: 8
    },
    {
      no: 2, title: '五段動詞・う／す', sub: '買う・話す：連用形變 い／し，て形為 買って／話して',
      forms: ['base', 'te', 'ta', 'nai', 'masu', 'masen', 'mashita'],
      types: ['godan'], cols: ['う', 'す'], count: 8
    },
    {
      no: 3, title: '五段・音便一', sub: 'ぐ・ぬ・ぶ・む段 → で・だ',
      forms: ['te', 'ta', 'masu', 'masen', 'mashita', 'nai'],
      types: ['godan'], cols: ['ぐ', 'ぬ', 'ぶ', 'む'], count: 10
    },
    {
      no: 4, title: '五段・音便二', sub: 'く段 き→い，る段 り→っ，つ段 っ',
      forms: ['te', 'ta', 'masu', 'nai'],
      types: ['godan'], cols: ['く', 'る', 'つ'], count: 10
    },
    {
      no: 5, title: '命令・禁止・条件', sub: '叫人做、叫別人不要、如果…',
      forms: ['meirei', 'kinshi', 'kate', 'te'],
      types: ['godan', 'ichidan'], count: 10
    },
    {
      no: 6, title: '意志・推量', sub: '要…吧？我們…吧',
      forms: ['you', 'darou', 'nai', 'tai'],
      types: ['godan', 'ichidan'], count: 8
    },
    {
      no: 7, title: 'する・来る', sub: '規則最不規則的兩個',
      forms: ['te', 'ta', 'nai', 'you', 'masu', 'masen', 'meirei', 'kate', 'darou'],
      types: ['suru', 'kuru'], count: 10
    },
    {
      no: 8, title: '可能・受身・使役', sub: '做得到／被做／讓人做',
      forms: ['dekita', 'dekitaimasu', 'ukerare', 'ukeraremasen', 'saseru', 'sasenai', 'te'],
      types: ['godan', 'ichidan', 'suru', 'kuru'], count: 12
    }
  ];

  /* ---------------- 出題 ----------------
     選動詞 → 選活用形 → 組出正確答案與三個干擾選項。
     干擾選項刻意從「同一個動詞但別的活用形」和
     「別的動詞的同一個活用形」取，讓選項看起來都像，
     不會一猜就中。                                              */

  /* 這一關可以用的動詞 */
  function verbsOf(level) {
    let list = verb.VERBS.filter(v => level.types.indexOf(v.type) !== -1);
    if (level.cols) {
      list = list.filter(v => level.cols.indexOf(v.col) !== -1);
    }
    return list;
  }

  /* 這個動詞能出的活用形 */
  function formsOf(v, level) {
    return verb.formsFor(v)
      .filter(f => level.forms.indexOf(f.key) !== -1)
      .map(f => f.key);
  }

  /* 組一題。formKeys 是這一關可以用的活用形，
     拿來當干擾選項的來源。回傳 null 表示配不出這題。 */
  function makeQuestion(v, key, formKeys) {
    const answer = verb.conjugate(v, key);
    if (!answer) return null;

    /* 干擾選項刻意從「同一個動詞的其他活用形」與
       「其他動詞的同一個活用形」取，讓選項看起來都像，不會一猜就中。
       太短的選項容易跟答案撞到，先濾掉。 */
    const wrong = new Set();
    const add = kana => {
      if (kana && kana !== answer && kana.length >= 2) wrong.add(kana);
    };

    verb.formsFor(v).forEach(f => { if (f.key !== key) add(verb.conjugate(v, f.key)); });

    const others = verb.VERBS.filter(x => x.kana !== v.kana);
    let guard = 0;
    while (wrong.size < 6 && guard++ < 200) {
      const o = others[Math.floor(Math.random() * others.length)];
      formKeys.forEach(k => add(verb.conjugate(o, k)));
    }

    const pool = Array.from(wrong);
    if (pool.length < 3) return null;

    return {
      verb: v,
      key: key,
      a: answer,
      opts: pool.slice(0, 3),
      from: verb.display(v, 'base'),   /* 題目上顯示的動詞（漢字＋注音） */
      zh: v.zh
    };
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 產生一關的題目 */
  function build(level) {
    const verbs = verbsOf(level);
    const poolKeys = level.forms.filter(k => k !== 'base');
    const out = [];
    const seen = new Set();
    let guard = 0;

    while (out.length < level.count && guard++ < 4000) {
      const v = verbs[Math.floor(Math.random() * verbs.length)];
      const forms = formsOf(v, level);
      if (!forms.length) continue;

      const key = forms[Math.floor(Math.random() * forms.length)];
      const q = makeQuestion(v, key, poolKeys);
      if (!q) continue;

      /* 同一個活用形在同一關不重複出題 */
      const sig = q.verb.kana + ':' + q.key;
      if (seen.has(sig)) continue;
      seen.add(sig);

      out.push(q);
    }

    return shuffle(out);
  }

  /* 快速搶答用的題庫：全部活用形混在一起 */
  function poolAll() {
    const allKeys = verb.FORMS.map(f => f.key);
    const out = [];
    verb.VERBS.forEach(v => {
      verb.formsFor(v).forEach(f => {
        const q = makeQuestion(v, f.key, allKeys);
        if (q) out.push(q);
      });
    });
    return out;
  }

  JPQ.VERB_LEVELS = LEVELS;
  JPQ.verbGame = {
    build: build,
    poolAll: poolAll,
    /* 這題為什麼是這個答案 */
    explain: function (q) {
      const e = verb.explain(q.verb, q.key);
      const note = q.verb.note || '';
      return { parts: e.parts, note: e.note || note };
    }
  };

})(window);
