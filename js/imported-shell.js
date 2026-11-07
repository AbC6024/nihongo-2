/* Use the same header, footer and tools as the original games. */
(function () {
  JPQ.store.load();
  JPQ.site.mountChrome(document.body.dataset.category);
  JPQ.site.wireTools();
  document.getElementById('soundBtn').addEventListener('click', () => {
    if (!JPQ.sfx.on) window.speechSynthesis?.cancel();
  });
})();
