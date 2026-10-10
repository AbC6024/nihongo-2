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
  const LEVELS = JPQ.verbStudy.LESSONS;

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
      opts: pool.slice(0, 2),
      from: verb.display(v, key === 'masu' ? 'base' : 'masu'),
      fromKey: key === 'masu' ? 'base' : 'masu',   /* 題目上顯示的動詞（漢字＋注音） */
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
