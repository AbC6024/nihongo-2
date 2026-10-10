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

  /* 干擾選項使用同一動詞的常見變化錯誤，不能只看詞尾辨認答案。 */
  function distractors(v, key) {
    const answer = verb.conjugate(v, key);
    const s = verb._internals.stems(v);
    const stem = s.stem, base = v.kana;
    const godan = v.type === 'godan', ichidan = v.type === 'ichidan';
    const prefix = s.prefix || '';
    let candidates = [];
    if (key === 'te' || key === 'ta') {
      const te = verb.conjugate(v, 'te');
      if (godan) {
        candidates = te.endsWith('って')
          ? [stem + 'いて', s.ren + 'て', stem + 'んで']
          : [te.slice(0, -1) + (te.endsWith('で') ? 'て' : 'で'), s.ren + 'て', stem + 'って'];
      } else if (ichidan) candidates = [stem + 'って', stem + 'いて', stem + 'りて'];
      else if (v.type === 'suru') candidates = [prefix + 'すて', prefix + 'しって', prefix + 'すって'];
      else candidates = [prefix + 'くて', prefix + 'こて', prefix + 'きって'];
      if (key === 'ta') candidates = candidates.map(k => k.slice(0, -1) + (k.endsWith('で') ? 'だ' : 'た'));
    } else if (key === 'masu') {
      candidates = godan ? [base + 'ます', s.mizen + 'ます', stem + 'ます']
        : ichidan ? [stem + 'るます', stem + 'ります']
        : v.type === 'suru' ? [prefix + 'するます', prefix + 'すます']
        : [prefix + 'くます', prefix + 'こます'];
    } else if (key === 'nai') {
      candidates = godan ? [s.ren + 'ない', base + 'ない', stem + 'ない']
        : ichidan ? [base + 'ない', stem + 'らない']
        : v.type === 'suru' ? [prefix + 'すない', prefix + 'するない']
        : [prefix + 'きない', prefix + 'くない'];
    } else if (key === 'base') {
      candidates = godan ? [s.ren + 'る', base + 'る', s.mizen + 'る']
        : ichidan ? [stem + 'う', stem + 'いる', stem + 'りる']
        : v.type === 'suru' ? [prefix + 'しる', prefix + 'すう']
        : [prefix + 'きる', prefix + 'こる'];
    } else if (key === 'dekita') {
      candidates = godan ? [s.ren + 'れる', base + 'れる', s.kateStem + 'られる']
        : ichidan ? [stem + 'られれる', base + 'られる']
        : v.type === 'suru' ? [prefix + 'しれる', prefix + 'するれる']
        : [prefix + 'きられる', prefix + 'くられる'];
    } else if (key === 'you') {
      candidates = godan ? [s.ren + 'よう', base + 'う', s.mizen + 'よう']
        : ichidan ? [stem + 'ろう', base + 'よう']
        : v.type === 'suru' ? [prefix + 'すよう', prefix + 'するよう']
        : [prefix + 'きよう', prefix + 'くよう'];
    } else if (key === 'meirei') {
      candidates = godan ? [stem + 'ろ', s.ren + 'れ', base + 'ろ']
        : ichidan ? [stem + 'れ', base + 'ろ']
        : v.type === 'suru' ? [prefix + 'すれ', prefix + 'するろ']
        : [prefix + 'くい', prefix + 'きい'];
    } else if (key === 'kinshi') {
      candidates = godan ? [s.ren + 'るな', s.mizen + 'るな', base + 'るな']
        : ichidan ? [stem + 'うな', stem + 'りな']
        : v.type === 'suru' ? [prefix + 'しるな', prefix + 'すな']
        : [prefix + 'きるな', prefix + 'こるな'];
    } else if (key === 'kate') {
      candidates = godan ? [s.ren + 'ば', base + 'ば', s.mizen + 'ば']
        : ichidan ? [stem + 'ば', base + 'ば']
        : v.type === 'suru' ? [prefix + 'しれば', prefix + 'するば']
        : [prefix + 'きれば', prefix + 'これば'];
    } else if (key === 'ukerare') {
      candidates = godan ? [s.mizen + 'られる', s.ren + 'れる', base + 'れる']
        : ichidan ? [base + 'られる', stem + 'らられる']
        : v.type === 'suru' ? [prefix + 'しられる', prefix + 'するられる']
        : [prefix + 'きられる', prefix + 'くられる'];
    } else if (key === 'saseru') {
      candidates = godan ? [s.ren + 'させる', base + 'させる', s.mizen + 'させる']
        : ichidan ? [stem + 'らせる', base + 'させる']
        : v.type === 'suru' ? [prefix + 'しさせる', prefix + 'するさせる']
        : [prefix + 'きさせる', prefix + 'くさせる'];
    } else {
      // 舊玩法的其他形式不在初級練習的選題範圍內。
      candidates = verb.formsFor(v).map(f => verb.conjugate(v, f.key));
    }
    // 一段可能形的ら抜き、命令形的「よ」等可接受說法，不作錯誤選項。
    const accepted = new Set([answer]);
    if (ichidan && key === 'dekita') accepted.add(stem + 'れる');
    if (v.type === 'kuru' && key === 'dekita') accepted.add(prefix + 'これる');
    if (ichidan && key === 'meirei') accepted.add(stem + 'よ');
    if (v.type === 'suru' && key === 'meirei') accepted.add(prefix + 'せよ');
    return Array.from(new Set(candidates)).filter(k => k && k.length >= 2 && !accepted.has(k)).slice(0, 2);
  }

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

  function makeQuestion(v, key) {
    const answer = verb.conjugate(v, key);
    if (!answer) return null;
    const wrong = distractors(v, key);
    if (wrong.length !== 2) return null;

    return {
      verb: v,
      key: key,
      a: answer,
      opts: wrong,
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
    const out = [];
    const seen = new Set();
    let guard = 0;

    while (out.length < level.count && guard++ < 4000) {
      const v = verbs[Math.floor(Math.random() * verbs.length)];
      const forms = formsOf(v, level);
      if (!forms.length) continue;

      const key = forms[Math.floor(Math.random() * forms.length)];
      const q = makeQuestion(v, key);
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
    const out = [];
    verb.VERBS.forEach(v => {
      verb.formsFor(v).forEach(f => {
        const q = makeQuestion(v, f.key);
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
