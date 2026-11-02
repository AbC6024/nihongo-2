/* Mount the retained adventure modes in the same kana page and router. */
(function (global) {
  const JPQ = global.JPQ;
  [
    { key: 'memory', title: '翻牌記憶', tag: '平假名・記憶', thumb: 'cards',
      desc: '翻開平假名與羅馬字，找出對應的一組。可選 2×3 或 3×4 網格。' },
    { key: 'sentence', title: '句子填空', tag: '平假名・應用', thumb: 'tiles',
      desc: '從單字到短句，每局 20 題，以假名與羅馬字完成填空。' }
  ].forEach(mode => {
    let instance = null;
    JPQ.registerGame({
      name: 'kana-' + mode.key, title: mode.title, sub: '平假名練習',
      card: { title: mode.title, tag: mode.tag, thumb: mode.thumb, desc: mode.desc },
      best: () => '',
      mount(stage) {
        const wrapper = document.createElement('div');
        wrapper.className = 'kana-extra';
        stage.appendChild(wrapper);
        instance = global.App[mode.key].mount(wrapper);
      },
      unmount() {
        if (instance) instance.destroy();
        instance = null;
        global.App.utils.closeAllModals();
        global.App.utils.Speech.stop();
      }
    });
  });
})(window);
