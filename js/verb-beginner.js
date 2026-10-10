/* 初級學習介面：從學生熟悉的ます形說明，一次只練一種變化。 */
(function (global) {
  const JPQ = global.JPQ, verb = JPQ.verb;
  const topics = [
    ['masu', 'ます形', '禮貌地說一個動作', '書く → 書きます'],
    ['te', 'て形', '請別人做一件事時會用到', '書きます → 書いて'],
    ['nai', 'ない形', '表示「不做」', '書きます → 書かない'],
    ['base', '辞書形', '字典裡的原形', '書きます → 書く'],
    ['ta', 'た形', '表示「做過了」', '書きます → 書いた'],
    ['dekita', '可能形', '表示「能夠做」', '書きます → 書ける'],
    ['you', '意向形', '表示「要做／一起做吧」', '書きます → 書こう'],
    ['meirei', '命令形', '直接叫別人做', '書きます → 書け'],
    ['kinshi', '禁止形', '叫別人不要做', '書きます → 書くな'],
    ['kate', '條件形（ば形）', '表示「如果做的話」', '書きます → 書けば'],
    ['ukerare', '受身形', '表示「被……」', '書きます → 書かれる'],
    ['saseru', '使役形', '表示「讓別人做」', '書きます → 書かせる']
  ];
  const LESSONS = topics.map((topic, i) => ({
    no: i + 1, title: topic[1], sub: topic[2], example: topic[3],
    forms: [topic[0]], types: ['godan', 'ichidan', 'suru', 'kuru'],
    count: 6, book: i < 5 ? 1 : 2
  }));

  function tip(v, key) {
    const masu = verb.conjugate(v, 'masu');
    const root = masu.slice(0, -2);
    const answer = verb.conjugate(v, key);
    const type = verb.TYPE_NAME[v.type];
    const result = rule => `${type}：${rule}。${key === 'masu' ? v.kana : masu} → ${answer}。`;
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

  function topicsHTML() {
    const cards = book => LESSONS.filter(l => l.book === book).map(l =>
      `<a class="level-btn" href="#/play/verb-quiz/${l.no}">
        <strong>${l.title}</strong><small>${l.sub}</small>
        <span class="vb-topic-example">${l.example}</span><small>6 題 · 開始練習 →</small>
      </a>`).join('');
    return `<h3 class="vb-h3">初級Ⅰ · 基礎變化</h3><div class="level-grid">${cards(1)}</div>
      <details class="vb-reference"><summary>初級Ⅱ · 更多變化</summary>
      <p class="section-note">學到這裡再練就好，一次選一種。</p><div class="level-grid">${cards(2)}</div></details>`;
  }
  JPQ.verbStudy = { LESSONS, tip, topicsHTML };
})(window);
