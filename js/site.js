/* =========================================================
   網站設定：站名、導覽、頁尾、遊戲縮圖
   ========================================================= */
window.JPQ = window.JPQ || {};

JPQ.SITE = {
  name: '遊戲學日語',
  nameEn: 'to learn Japanese',
  tagline: '免費的日語學習小遊戲網站',
  description: '用一款款小遊戲練日語。免費、免安裝，打開瀏覽器就能玩。'
};

/* ---------------- 遊戲縮圖（純 CSS，不用圖檔） ---------------- */
const THUMBS = {
  link: `
    <span class="t-cloud"></span>
    <span class="t-pair t-pair-a">は</span>
    <span class="t-pair t-pair-b">が</span>
    <span class="t-link"></span>`,
  kana: `
    <span class="t-grid"></span>
    <span class="t-char t-char-a">あ</span>
    <span class="t-char t-char-b">ア</span>
    <span class="t-char t-char-c">ん</span>`,
  cards: `
    <span class="t-card t-card-1"></span>
    <span class="t-card t-card-2"></span>
    <span class="t-card t-card-3"></span>`,
  clock: `
    <span class="t-clock-face"></span>
    <span class="t-hand t-h1"></span>
    <span class="t-hand t-h2"></span>`,
  quiz: `
    <span class="t-sentence"></span>
    <span class="t-gap"></span>
    <span class="t-opt t-o1"></span><span class="t-opt t-o2"></span>
    <span class="t-opt t-o3"></span><span class="t-opt t-o4"></span>`,
  speed: `<span class="t-bolt"></span>`,
  tiles: `<span class="t-tile t-t1"></span><span class="t-tile t-t2"></span><span class="t-tile t-t3"></span>`,
  listen: `<span class="t-wave"></span>`
};

JPQ.site = {
  thumb: function (kind) { return THUMBS[kind] || THUMBS.quiz; },

  /* 產生 header（logo + 選單）與 footer */
  mountChrome: function (active) {
    const S = JPQ.SITE;
    /* 選單＝首頁 + 所有已上線的遊戲 + 關於本站 */
    const items = [{ id: 'games', label: '首頁', href: 'index.html' }]
      .concat((JPQ.CATALOG || []).filter(g => g.status === 'live')
        .map(g => ({ id: g.slug, label: g.title, href: g.href })))
      .concat([{ id: 'about', label: '關於本站', href: 'index.html#about' }]);

    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `<div class="header-inner">
      <a class="site-logo" href="index.html">
        <span class="logo-games">遊戲</span>
        <span class="logo-sub">${S.nameEn}</span>
      </a>
      <nav class="site-menu" aria-label="主選單">
        <ul>
          ${items.map(p => `<li><a href="${p.href}"${active === p.id ? ' class="on"' : ''}>${p.label}</a></li>`).join('')}
        </ul>
      </nav>
      <div class="header-tools">
        <button id="soundBtn" class="tool-btn" type="button" title="音效開關" aria-label="音效開關" aria-pressed="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3l4.5-3.5v12L7 14.5H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18 6.7a7.5 7.5 0 0 1 0 10.6"/></svg>
        </button>
        <button id="resetBtn" class="tool-btn" type="button" title="清除所有進度" aria-label="清除所有進度">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/></svg>
        </button>
      </div>
    </div>`;

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    const liveLinks = (JPQ.CATALOG || []).filter(g => g.status === 'live')
      .map(g => `<a href="${g.href}">${g.title}</a>`).join('<span>·</span>');
    footer.innerHTML = `
      <div class="foot-rule"></div>
      <div class="wrap foot-cols">
        <div class="foot-col">
          <p><a href="index.html">遊戲學日語</a></p>
          <p>Games to Learn Japanese</p>
          <p>用遊戲練日語</p>
        </div>
        <div class="foot-col">
          <p><a href="index.html">首頁</a></p>
          ${liveLinks}
        </div>
        <div class="foot-col">
          <p><a href="index.html#about">關於本站</a></p>
          <p>進度只存在你的瀏覽器</p>
          <p>免費・免安裝</p>
        </div>
      </div>
      <div class="foot-rule"></div>`;

    const hs = document.getElementById('site-header');
    const fs = document.getElementById('site-footer');
    if (hs) hs.replaceWith(header); else document.body.insertBefore(header, document.body.firstChild);
    if (fs) fs.replaceWith(footer);
  },

  wireTools: function () {
    const sBtn = document.getElementById('soundBtn');
    if (sBtn) {
      const saved = JPQ.store.load().sound;
      JPQ.sfx.on = saved !== false;
      const paint = () => {
        sBtn.classList.toggle('off', !JPQ.sfx.on);
        sBtn.setAttribute('aria-pressed', String(JPQ.sfx.on));
      };
      paint();
      sBtn.addEventListener('click', () => {
        JPQ.sfx.on = !JPQ.sfx.on;
        const d = JPQ.store.load(); d.sound = JPQ.sfx.on; JPQ.store.save();
        paint();
        if (JPQ.sfx.on) JPQ.sfx.correct();
      });
    }

    const rBtn = document.getElementById('resetBtn');
    if (rBtn) {
      rBtn.addEventListener('click', () => {
        JPQ.modal.show({
          title: '清除所有進度？',
          html: '<p>星星、最高分與關卡紀錄都會被清掉，這個動作不能復原。</p>',
          actions: [
            { label: '清除', cls: 'grey', onClick: () => {
              JPQ.store.reset();
              JPQ.modal.close();
              location.reload();
            } },
            { label: '取消', onClick: () => JPQ.modal.close() }
          ]
        });
      });
    }
  }
};
