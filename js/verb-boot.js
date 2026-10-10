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

    box.innerHTML = '<span class="stat-chip">一次 6 題</span><span class="stat-chip">不計時，慢慢想</span>';
    const topics = U.$('#verbTopics');
    if (topics) topics.innerHTML = JPQ.verbStudy.topicsHTML();
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
