/* 一次只查一種變化，使用初級教材的三類動詞名稱。 */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util, verb = JPQ.verb;
  JPQ.verbSheet = {
    render: function () {
      const box = U.$('#verbSheet');
      if (!box) return;
      const study = JPQ.verbStudy;
      box.innerHTML = `<label for="vbStudyForm">想查哪一種變化？</label>
        <select id="vbStudyForm" class="vb-study-select">
          ${[1, 2].map(book => `<optgroup label="初級${book === 1 ? 'Ⅰ' : 'Ⅱ'}">
            ${study.LESSONS.filter(l => l.book === book).map(l => `<option value="${l.forms[0]}" ${l.forms[0] === 'te' ? 'selected' : ''}>${l.title}</option>`).join('')}
          </optgroup>`).join('')}
        </select><div id="vbStudyExamples"></div>`;
      const draw = key => {
        const lesson = study.LESSONS.find(l => l.forms[0] === key);
        const source = key === 'masu' ? 'base' : 'masu';
        const samples = ['かく', 'たべる', 'する', 'くる'].map(k => verb.byKana(k));
        const row = v => `<tr><th>${verb.TYPE_NAME[v.type]}</th>
          <td>${U.ruby(verb.display(v, source))}<em>${v.zh}</em></td>
          <td>${U.ruby(verb.display(v, key))}</td></tr>`;
        U.$('#vbStudyExamples', box).innerHTML = `<div class="vb-scroll"><table class="vb-grid">
          <thead><tr><th>動詞分類</th><th>${source === 'masu' ? 'ます形' : '辞書形'}</th><th>${lesson.title}</th></tr></thead>
          <tbody>${samples.map(row).join('')}</tbody></table></div>
          <div class="vb-simple-tips">${samples.map(v => `<p>${study.tip(v, key)}</p>`).join('')}</div>
          <details class="vb-reference"><summary>看更多動詞的${lesson.title}</summary>
            <div class="vb-scroll"><table class="vb-grid"><thead><tr><th>分類</th><th>原來的說法</th><th>${lesson.title}</th></tr></thead>
            <tbody>${verb.VERBS.filter(v => verb.supports(v, key)).map(row).join('')}</tbody></table></div>
          </details>`;
      };
      draw('te');
      U.$('#vbStudyForm', box).addEventListener('change', e => draw(e.target.value));
    }
  };
})(window);
