/* ==========================================================================
   app.js — 路由、主選單、導覽列互動
   ========================================================================== */
(function (global) {
  'use strict';

  var U = global.App.utils;
  var D = global.KanaData;
  var el = U.el, qs = U.qs, qsa = U.qsa;

  var appEl = qs('#app');
  var navToggle = qs('#navToggle');
  var navLinks = qs('#navLinks');
  var current = null;   // 目前遊戲實例（需 destroy）

  /* ======================================================== 主選單 */
  function renderMenu() {
    U.clear(appEl);

    var page = el('div');

    /* Hero：不顯示任何分數紀錄，只說明內容 */
    var stats = [
      { label: '初階 連連看', icon: '🌸', value: '6 個關卡 · 由簡入繁' },
      { label: '進階 翻牌記憶', icon: '🃏', value: '5 種網格 · 和風卡牌' },
      { label: '高階 句子填空', icon: '📝', value: '15 題 · 三個難度' }
    ].map(function (s) {
      return el('span.hero__stat', [s.icon + ' ' + s.label + '　' + s.value]);
    });

    page.appendChild(el('section.hero', [
      el('span.hero__kana', { text: 'あ い う え お　か き く け こ' }),
      el('h1', { text: '五十音大冒險' }),
      el('p.hero__lead', { text: D.MOTIVATION.hero }),
      el('p.hero__sub', { text: '先認字配對，再記憶翻牌，最後挑戰由單字到整句的填空。' }),
      el('div.hero__stats', stats)
    ]));

    /* 三張模式卡（不顯示任何分數紀錄） */
    page.appendChild(el('div.modes', [
      modeCard({
        href: '#/matching', cls: 'matching', glyph: 'あ',
        lv: 'LEVEL 1・初階', title: '連連看', jp: 'CONNECT THE PAIRS',
        desc: '畫面分成左右兩欄，一邊是平假名、一邊是羅馬字。焦らず少しずつ：基礎 5 關依五十音行解鎖，每批 5 組；最後「五十音全測驗」把 46 音分成 3 輪（15/15/16），畫面固定 5 組、連對後自動補上。',
        list: ['6 個關卡：あか → さた → なは → まや → らわ → 五十音全測驗',
               '配對成功的卡片連線後消失，消除完一批自動載入下一批',
               '點假名即可聽日語發音；連對 2 組以上會啟動連擊'],
        cta: '開始連連看'
      }),
      modeCard({
        href: '#/memory', cls: 'memory', glyph: 'か',
        lv: 'LEVEL 2・進階', title: '翻牌記憶', jp: 'MEMORY FLIP GAME',
        desc: '日系和風卡牌：圓角、3D 翻轉、青海波紋與櫻花徽記，翻開大字體平假名或羅馬字。奇數網格多一張萬用卡（或留白），偶數網格全部成對。',
        list: ['3×3 / 4×4 / 5×5 / 6×6 / 7×7 五種網格自由選',
               '翻開假名片會自動朗讀，邊記邊聽',
               '不配對時會停留一下，讓你看清楚兩張牌'],
        cta: '開始翻牌'
      }),
      modeCard({
        href: '#/sentence', cls: 'sentence', glyph: '文',
        lv: 'LEVEL 3・高階', title: '句子填空', jp: 'SENTENCE FILL-IN',
        desc: '由簡入繁：先單字短語（すし、ねこ），再基礎短句（おはよう、すみません），最後完整句子（わたしはがくせいです）。🔊 可隨時聆聽日語發音，答對會自動朗讀一次。',
        list: ['兩種題型隨機出題：填平假名／填羅馬字',
               '🔊 日語發音可重複播放；答對自動朗讀整句一次',
               '助詞「は」依拼音規範寫作 ha，並附「發音 wa」提醒'],
        cta: '開始填空'
      })
    ]));

    page.appendChild(el('p.hint-text', {
      style: { textAlign: 'center', marginTop: '26px' },
      html: '你的關卡解鎖進度會自動保存在這台裝置上，關掉頁面也不會消失。<br>' +
            '本遊戲只保存關卡解鎖，與五十音圖、日語聽打及其他遊戲的紀錄分開。'
    }));

    appEl.appendChild(page);
    setActiveNav('');
  }

  function modeCard(o) {
    return el('a.mode-card.mode-card--' + o.cls, {
      href: o.href, 'data-glyph': o.glyph, 'aria-label': o.title
    }, [
      el('div.mode-card__top', [
        el('div.mode-card__lv', { text: o.lv }),
        el('h2.mode-card__title', { text: o.title }),
        el('div.mode-card__jp', { text: o.jp })
      ]),
      el('div.mode-card__body', [
        el('p.mode-card__desc', { text: o.desc }),
        el('ul.mode-card__list', o.list.map(function (t) { return el('li', { text: t }); })),
        el('div.mode-card__foot', [
          el('span.mode-card__hint', { text: o.hint || D.MOTIVATION.menu }),
          el('span.mode-card__go', { text: (o.cta || '開始') + ' →' })
        ])
      ])
    ]);
  }

  /* ======================================================== 路由 */
  var ROUTES = {
    matching: function () { return global.App.matching.mount(appEl); },
    memory: function () { return global.App.memory.mount(appEl); },
    sentence: function () { return global.App.sentence.mount(appEl); }
  };

  function route() {
    var hash = (location.hash || '#/').replace(/^#\/?/, '');
    var key = hash.split('?')[0];

    destroyCurrent();
    U.closeAllModals();
    U.clear(appEl);
    closeNav();

    if (ROUTES[key]) {
      try {
        current = ROUTES[key]();
      } catch (err) {
        appEl.appendChild(errorPanel(err));
      }
      setActiveNav(key);
    } else {
      renderMenu();
    }

    appEl.focus({ preventScroll: true });
    U.scrollTop();
  }

  function destroyCurrent() {
    if (current && typeof current.destroy === 'function') {
      try { current.destroy(); } catch (e) { /* ignore */ }
    }
    current = null;
  }

  function errorPanel(err) {
    return el('div.panel', [
      el('h2', { text: '😵 這個模式出了點問題' }),
      el('p.hint-text', { text: String(err && err.message || err) }),
      el('a.btn', { href: '#/' }, '回到主選單')
    ]);
  }

  /* ======================================================== 導覽列 */
  function setActiveNav(key) {
    qsa('.nav__link').forEach(function (a) {
      a.classList.toggle('is-active', a.dataset.route === key);
    });
  }

  function closeNav() {
    navLinks.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  navToggle.addEventListener('click', function () {
    var open = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  navLinks.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('a')) closeNav();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', function () {
    destroyCurrent();
    U.closeAllModals();
    U.Speech.stop();
  });
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) route();
  });

  /* ======================================================== 啟動 */
  route();
})(window);
