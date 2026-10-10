/* =========================================================
   動詞活用專頁啟動
   （助詞專頁的 boot.js 換成這一份就好，差別只有「掛哪個速查表」）
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;

  /* 首頁那幾個統計數字：收錄動詞數、活用形數、拼過的動詞數 */
  function renderHero() {
    const box = U.$('#heroStats');
    if (!box) return;

    const verb = JPQ.verb;
    /* 拼圖玩法零失誤才會記錄，所以這裡數的是「完全解鎖」的動詞 */
    const mastered = verb.VERBS.filter(v => JPQ.store.record('verb-scramble-' + v.kana) > 0).length;

    const cards = [
      { n: verb.VERBS.length, l: '收錄動詞', e: 'verbs' },
      { n: verb.FORMS.length, l: '活用形', e: 'forms' },
      { n: verb.GODAN_ORDER.length, l: '五段的段', e: 'godan rows' },
      { n: mastered, l: '完全解鎖', e: 'mastered' }
    ];

    box.innerHTML = cards.map(c =>
      `<span class="stat-chip">${c.e} <b>${c.n}</b> ${c.l}</span>`).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    JPQ.store.load();
    JPQ.site.mountChrome('conjugation');
    JPQ.site.wireTools();
    JPQ.hud.init();
    JPQ.fx.boot();
    JPQ.speech.init();
    JPQ.home.render();
    JPQ.verbSheet.render();
    JPQ.lb.init();

    global.addEventListener('hashchange', function () {
      JPQ.modal.close();
      JPQ.home.render();
      JPQ.router();
    });

    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      if (location.hash !== '#/') location.hash = '#/';
      else JPQ.router();
    } else {
      JPQ.router();
    }

    renderHero();
  });
})(window);
