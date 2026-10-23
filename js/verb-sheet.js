/* 對照表只展示初級Ⅰ・Ⅱ收錄動詞與本頁的學習範圍。 */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util, verb = JPQ.verb;
  JPQ.verbSheet = { render: function () {
    const box = U.$('#verbSheet'); if (!box) return;
    const study = JPQ.verbStudy, ruby = value => U.ruby(U.escapeHTML(value));
    box.innerHTML = `<div class="vb-sheet-controls"><label for="vbStudyForm">想查哪一種變化？<select id="vbStudyForm" class="vb-study-select">
      ${study.LESSONS.map(l => `<option value="${l.forms[0]}" ${l.forms[0] === 'te' ? 'selected' : ''}>${l.title}</option>`).join('')}
      </select></label><label for="vbStudyBook">查閱字彙來源<select id="vbStudyBook" class="vb-study-select"><option value="all">初級Ⅰ＋Ⅱ</option>
      <option value="1">初級Ⅰ · 第 1～12 課</option><option value="2">初級Ⅱ · 第 13～25 課</option></select></label></div><div id="vbStudyExamples"></div>`;
    const draw = () => {
      const key = U.$('#vbStudyForm', box).value, book = U.$('#vbStudyBook', box).value;
      const lesson = study.lessonFor(key), sourceKey = key === 'masu' ? 'base' : 'masu';
      const list = study.VOCAB.filter(v => (book === 'all' || String(v.book) === book) && verb.supports(v, key));
      const samples = ['かく', 'たべる', 'する', 'くる'].map(k => list.find(v => v.kana === k)).filter(Boolean);
      ['godan', 'ichidan', 'suru', 'kuru'].forEach(type => {
        if (!samples.some(v => v.type === type)) { const v = list.find(v => v.type === type); if (v) samples.push(v); }
      });
      const row = v => `<tr><th>${verb.TYPE_NAME[v.type]}</th><td>${U.escapeHTML(v.zh)}<small class="vb-table-source">初級${Number(v.book) === 1 ? 'Ⅰ' : 'Ⅱ'} · 第 ${v.lesson} 課</small></td>
        <td>${ruby(verb.display(v, sourceKey))}</td><td>${ruby(verb.display(v, key))}</td></tr>`;
      const table = verbs => `<div class="vb-scroll"><table class="vb-grid"><thead><tr><th>動詞分類</th><th>中文意思／課次</th><th>${sourceKey === 'masu' ? 'ます形' : '辞書形'}</th><th>${lesson.title}</th></tr></thead><tbody>${verbs.map(row).join('')}</tbody></table></div>`;
      U.$('#vbStudyExamples', box).innerHTML = `<p class="vb-sheet-note">${lesson.sub}</p>${table(samples)}<div class="vb-simple-tips">${samples.map(v => `<p>${U.escapeHTML(study.tip(v, key))}</p>`).join('')}</div>
        <details class="vb-reference"><summary>查看收錄字彙的${lesson.title} · ${list.length} 個動詞</summary>${table(list)}</details>`;
    };
    draw(); U.$('#vbStudyForm', box).addEventListener('change', draw); U.$('#vbStudyBook', box).addEventListener('change', draw);
  } };
})(window);
