(function () {
  const route = location.hash.replace(/^#\/?/, '').split('?')[0];
  const routes = { memory: '#/play/kana-memory/hiragana', sentence: '#/play/kana-sentence/hiragana', matching: '#/play/kana-match/hiragana' };
  location.replace('../gojuon.html' + (routes[route] || '#/'));
})();
