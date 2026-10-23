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
    const polite = { masen:'ません', mashita:'ました', masendeshita:'ませんでした', mashimashou:'ましょう', masenka:'ませんか' };
    if (polite[key]) return distractors(v, 'masu').map(k => k.slice(0, -2) + polite[key]);
    if (key === 'nakatta') return distractors(v, 'nai').map(k => k.slice(0, -2) + 'なかった');
    if (key === 'tara') return distractors(v, 'ta').map(k => k + 'ら');
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
    const types = level.types || ['godan', 'ichidan', 'suru', 'kuru'];
    let list = JPQ.verbStudy.VOCAB.filter(v => v.lesson >= 1 && v.lesson <= 25 &&
      types.indexOf(v.type) !== -1 &&
      (level.book === 'all' || String(v.book) === String(level.book)));
    if (level.cols) {
      list = list.filter(v => level.cols.indexOf(v.col) !== -1);
    }
    return list;
  }

  /* 這個動詞能出的活用形 */
  function formsOf(v, level) {
    return verb.formsFor(v)
      .filter(f => JPQ.verbStudy.FORM_KEYS.indexOf(f.key) !== -1 && level.forms.indexOf(f.key) !== -1)
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
    level = Object.assign({ book: 'all', forms: JPQ.verbStudy.FORM_KEYS }, level);
    if (!['all', '1', '2'].includes(String(level.book)) || !Array.isArray(level.forms)) return [];
    const forms = shuffle(JPQ.verbStudy.FORM_KEYS.filter(key => level.forms.includes(key)));
    if (!forms.length) return [];
    // 先列出可用字彙再洗牌，固定抽10個不同動詞，不靠不斷重抽湊題數。
    const seen = new Set();
    const candidates = shuffle(verbsOf(level)).filter(v => {
      const id = v.id || v.kana;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).map(v => ({ verb: v, questions: formsOf(v, level).map(key => makeQuestion(v, key)).filter(Boolean) }))
      .filter(item => item.questions.length);
    if (candidates.length < 10) return [];
    const out = [];
    candidates.slice(0, 10).forEach((item, i) => {
      // 綜合練習輪替形式，同時略過該動詞不適用的形式。
      const preferred = forms.slice(i % forms.length).concat(forms.slice(0, i % forms.length));
      const key = preferred.find(key => item.questions.some(q => q.key === key));
      out.push(item.questions.find(q => q.key === key));
    });
    return shuffle(out);
  }

  /* 快速搶答用的題庫：全部活用形混在一起 */
  function poolAll() {
    const out = [];
    verbsOf({ book:'all' }).forEach(v => {
      formsOf(v, { forms:JPQ.verbStudy.FORM_KEYS }).forEach(key => {
        const q = makeQuestion(v, key);
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
