/* 初級學習介面：從學生熟悉的ます形說明，一次只練一種變化。 */
(function (global) {
  const JPQ = global.JPQ, verb = JPQ.verb;
  // 台灣版初級Ⅰ為1–12課、初級Ⅱ為13–25課；保留舊1–4編號的進度。
  const topics = [
    [1, 'te', 'て形', '連接動作、提出請求', '書きます → 書いて', 14, 'plain'],
    [2, 'nai', 'ない形', '普通體的否定', '書きます → 書かない', 17, 'plain'],
    [3, 'base', '辞書形', '字典裡的原形', '書きます → 書く', 18, 'plain'],
    [4, 'ta', 'た形', '普通體的過去', '書きます → 書いた', 19, 'plain'],
    [12, 'masu', 'ます形', '禮貌地說明動作', '書く → 書きます', 4, 'polite'],
    [13, 'masen', 'ません', '禮貌地表示不做', '書きます → 書きません', 4, 'polite'],
    [14, 'mashita', 'ました', '禮貌地表示做過了', '書きます → 書きました', 4, 'polite'],
    [15, 'masendeshita', 'ませんでした', '禮貌地表示過去沒做', '書きます → 書きませんでした', 4, 'polite'],
    [16, 'nakatta', 'なかった形', '普通體的過去否定', '書きます → 書かなかった', 20, 'plain'],
    [17, 'mashimashou', 'ましょう', '提議一起做', '書きます → 書きましょう', 6, 'phrase'],
    [18, 'masenka', 'ませんか', '邀請對方一起做', '書きます → 書きませんか', 6, 'phrase'],
    [19, 'tara', 'たら形', '表示「如果……」的條件', '書きます → 書いたら', 25, 'phrase']
  ];
  const TYPES = ['godan', 'ichidan', 'suru', 'kuru'];
  const LESSONS = topics.map(t => ({
    no: t[0], title: t[2], sub: t[3], example: t[4],
    forms: [t[1]], types: TYPES.slice(), count: 10,
    book: t[5] <= 12 ? 1 : 2, lesson: t[5], group: t[6]
  }));
  const lessonFor = key => LESSONS.find(l => l.forms[0] === key);
  const FORM_KEYS = LESSONS.map(l => l.forms[0]);

  function configFor(hash) {
    const parts = String(hash || '').replace(/^#\/?/, '').split('/');
    if (parts[0] !== 'play' || parts[1] !== 'verb-quiz') return null;
    const selected = parts[2];
    const book = parts[3] || 'all';
    if (!['all', '1', '2'].includes(book) || parts.length > 4) return null;
    const lesson = /^\d+$/.test(selected || '')
      ? LESSONS.find(l => l.no === Number(selected)) : lessonFor(selected);
    if (selected !== 'mixed' && !lesson) return null;
    return {
      no: lesson ? lesson.no : null, key: lesson ? lesson.forms[0] : 'mixed',
      title: lesson ? lesson.title : '綜合變化',
      sub: lesson ? lesson.sub : '混合第 1～25 課的基本變化',
      forms: lesson ? lesson.forms.slice() : FORM_KEYS.slice(),
      types: TYPES.slice(), count: 10, book
    };
  }

  function tip(v, key) {
    const masu = verb.conjugate(v, 'masu');
    const root = masu.slice(0, -2);
    const answer = verb.conjugate(v, key);
    const type = verb.TYPE_NAME[v.type];
    const result = rule => `${type}：${rule}。${key === 'masu' ? v.kana : masu} → ${answer}。`;
    const polite = { masen:'ません', mashita:'ました', masendeshita:'ませんでした', mashimashou:'ましょう', masenka:'ませんか' };
    if (polite[key]) return result(`把「ます」換成「${polite[key]}」`);
    if (key === 'nakatta') return result(`先變成「${verb.conjugate(v, 'nai')}」，再把最後的「ない」換成「なかった」`);
    if (key === 'tara') return result(`先變成た形「${verb.conjugate(v, 'ta')}」，再加「ら」`);
    if (key === 'masu') return result(v.type === 'godan'
      ? `把原形最後的「${v.col}」換成「${root.slice(-1)}ます」`
      : v.type === 'ichidan' ? '去掉原形最後的「る」，加「ます」'
      : v.type === 'suru' ? '「する」換成「します」' : '「くる」換成「きます」');
    if (v.kana === 'ある' && key === 'nai') return '特別記：あります 的ない形是「ない」。';
    if ((key === 'te' || key === 'ta') && v.kana === 'いく') return `特別記：いきます → ${answer}。`;
    if (key === 'te' || key === 'ta') {
      const suffix = key === 'te' ? 'て' : 'た';
      if (v.type !== 'godan') return result(`去掉「ます」，加「${suffix}」`);
      const endings = {
        'う': ['い', 'っ' + suffix], 'つ': ['ち', 'っ' + suffix], 'る': ['り', 'っ' + suffix],
        'む': ['み', key === 'te' ? 'んで' : 'んだ'],
        'ぶ': ['び', key === 'te' ? 'んで' : 'んだ'],
        'ぬ': ['に', key === 'te' ? 'んで' : 'んだ'],
        'く': ['き', 'い' + suffix], 'ぐ': ['ぎ', key === 'te' ? 'いで' : 'いだ'],
        'す': ['し', 'し' + suffix]
      };
      const pair = endings[v.col];
      return result(`把最後的「${pair[0]}ます」換成「${pair[1]}」`);
    }
    if (key === 'base') {
      if (v.type === 'godan') return result(`把最後的「${root.slice(-1)}ます」換成「${v.col}」`);
      return result(v.type === 'ichidan' ? '把「ます」換成「る」'
        : v.type === 'suru' ? '把「します」換成「する」' : '「きます」換成「くる」');
    }
    if (key === 'nai') {
      if (v.type === 'godan') return result(`把最後的「${root.slice(-1)}ます」換成「${answer.slice(root.length - 1)}」`);
      return result(v.type === 'kuru' ? '「きます」換成「こない」' : '把「ます」換成「ない」');
    }
    if (key === 'kinshi') return result('先變成辞書形，再加「な」');
    if (v.type === 'suru') {
      const endings = { dekita:'できる', you:'しよう', meirei:'しろ', kate:'すれば', ukerare:'される', saseru:'させる' };
      return result(`把「します」換成「${endings[key]}」`);
    }
    if (v.type === 'kuru') return `第Ⅲ類，直接記這組：${masu} → ${answer}。`;
    if (v.type === 'ichidan') {
      const endings = { dekita:'られる', you:'よう', meirei:'ろ', kate:'れば', ukerare:'られる', saseru:'させる' };
      return result(`把「ます」換成「${endings[key]}」`);
    }
    return result(`把最後的「${root.slice(-1)}ます」換成「${answer.slice(root.length - 1)}」`);
  }

  function topicsHTML(book = 'all') {
    if (!['all', '1', '2'].includes(String(book))) book = 'all';
    const cards = group => LESSONS.filter(l => l.group === group).map(l =>
      `<a class="level-btn" href="#/play/verb-quiz/${l.forms[0]}/${book}">
        <strong>${l.title}</strong><small>${l.sub}</small>
        <span class="vb-topic-example">${l.example}</span><small>第 ${l.lesson} 課 · 隨機 10 題 →</small>
      </a>`).join('');
    return [['polite', 'ます形與禮貌體'], ['plain', '普通形與て形'], ['phrase', '邀請與條件']]
      .map(([group, title]) => `<h3 class="vb-h3">${title}</h3><div class="level-grid">${cards(group)}</div>`).join('');
  }
  JPQ.verbStudy = { LESSONS, FORM_KEYS, VOCAB: JPQ.verbVocab.VERBS, tip, topicsHTML, lessonFor, configFor };
})(window);
