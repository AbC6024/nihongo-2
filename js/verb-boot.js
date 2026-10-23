/* 動詞專頁：先選字彙來源與變化，每輪固定 10 題。 */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  function setupPractice() {
    const form = U.$('#verbPracticeForm');
    if (!form) return;
    const study = JPQ.verbStudy;
    const bookSelect = U.$('#verbBook', form), formSelect = U.$('#verbForm', form);
    const bookLabel = book => book === '1' ? '初級Ⅰ（第 1～12 課）' : book === '2' ? '初級Ⅱ（第 13～25 課）' : '初級Ⅰ＋Ⅱ（第 1～25 課）';
    const available = book => study.VOCAB.filter(v => book === 'all' || String(v.book) === book);
    formSelect.innerHTML = '<option value="mixed">綜合變化</option>' + study.LESSONS.map(l => `<option value="${l.forms[0]}">${l.title}</option>`).join('');
    function draw() {
      const book = bookSelect.value, source = available(book);
      U.$('#verbPoolInfo').textContent = `${bookLabel(book)} · 已收錄 ${source.length} 個動詞，每輪隨機抽 10 個，不重複。`;
      const topics = U.$('#verbTopics'); if (topics) topics.innerHTML = study.topicsHTML(book);
      const sheetBook = U.$('#vbStudyBook');
      if (sheetBook && sheetBook.value !== book) { sheetBook.value = book; sheetBook.dispatchEvent(new Event('change')); }
    }
    bookSelect.addEventListener('change', draw);
    form.addEventListener('submit', e => { e.preventDefault(); JPQ.sfx.click(); JPQ.go('#/play/verb-quiz/' + formSelect.value + '/' + bookSelect.value); });
    const stats = U.$('#heroStats');
    if (stats) stats.innerHTML = `<span class="stat-chip">每輪 10 題</span><span class="stat-chip">${study.VOCAB.length} 個收錄動詞</span><span class="stat-chip">${study.LESSONS.length} 種變化</span>`;
    draw();
  }
  document.addEventListener('DOMContentLoaded', function () {
    JPQ.store.load(); JPQ.site.mountChrome('conjugation'); JPQ.site.wireTools();
    JPQ.hud.init(); JPQ.fx.boot(); JPQ.speech.init(); JPQ.home.render(); JPQ.verbSheet.render(); JPQ.lb.init(); setupPractice();
    global.addEventListener('hashchange', function () { JPQ.modal.close(); JPQ.home.render(); JPQ.router(); });
    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      if (location.hash !== '#/') location.hash = '#/'; else JPQ.router();
    } else JPQ.router();
  });
})(window);
