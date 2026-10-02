/* =========================================================
   助詞遊戲專頁啟動
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;

  document.addEventListener('DOMContentLoaded', function () {
    JPQ.store.load();
    JPQ.site.mountChrome('particles');
    JPQ.site.wireTools();
    JPQ.hud.init();
    JPQ.fx.boot();
    JPQ.home.render();

    /* 返回鍵（瀏覽器上一頁）統一關掉彈窗 */
    global.addEventListener('hashchange', function () {
      JPQ.modal.close();
      JPQ.home.render();
      JPQ.router();
    });

    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      /* 沒有指定遊戲就停在助詞大冒險首頁 */
      if (location.hash !== '#/') location.hash = '#/';
      else JPQ.router();
    } else {
      JPQ.router();
    }
  });
})(window);
