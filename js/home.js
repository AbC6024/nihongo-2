/* =========================================================
   首頁：遊戲目錄 / 步驟說明 / 助詞速查表 / 統計
   （助詞專頁只用到遊戲目錄與速查表，缺元素時自動略過）
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;

  /* ---- 遊戲卡片：縮圖 + 標題 + 一句話說明 ---- */
  function renderCatalog() {
    const grid = U.$('#gameGrid');
    if (!grid) return;
    grid.innerHTML = (JPQ.games && Object.keys(JPQ.games).length) ? gamesHTML() : catalogHTML();
  }

  function cardHTML(g) {
    const live = g.status === 'live';
    const note = live ? '' : `<span class="pane-note">${g.titleNote || '開發中'}</span>`;
    const detail = live && g.detail
      ? `<ul class="pane-tags">${g.detail.map(d => `<li>${d}</li>`).join('')}</ul>`
      : '';
    const go = live
      ? '<span class="pane-go">開始玩 →</span>'
      : '<span class="pane-go pane-go-off">敬請期待</span>';
    const inner = `
      <span class="pane-title">${g.title}<em>${g.titleEn || ''}</em></span>
      <span class="pane-thumb thumb-${g.thumb || 'quiz'}">${JPQ.site.thumb(g.thumb)}</span>
      <span class="pane-body">
        <p class="pane-par">${g.desc}</p>
        ${detail}
      </span>
      ${go}${note}`;
    return live
      ? `<a class="pane" href="${g.href}">${inner}</a>`
      : `<div class="pane is-soon">${inner}</div>`;
  }

  function catalogHTML() {
    return JPQ.CATALOG.map(cardHTML).join('');
  }

  function gamesHTML() {
    return Object.keys(JPQ.games).map(k => {
      const g = JPQ.games[k];
      return cardHTML({
        status: 'live', title: g.card.title, titleEn: g.card.tag,
        thumb: g.card.thumb, desc: g.card.desc, href: '#/play/' + g.name
      });
    }).join('');
  }

  /* ---- 三步驟說明 ---- */
  function renderSteps() {
    const box = U.$('#stepGrid');
    if (!box) return;
    const steps = [
      { icon: '🧭', title: '挑一款遊戲', text: '點任何一張卡片就能開始，不用下載或安裝。' },
      { icon: '✏️', title: '一邊玩一邊記', text: '答錯會馬上跳出正確答案和原因，比看十次課本印象深。' },
      { icon: '🌸', title: '回頭查速查表', text: '遊戲頁面下方永遠有一張助詞速查表可以隨時複習。' }
    ];
    box.innerHTML = steps.map((s, i) => `<div class="step-card">
      <span class="step-no">${i + 1}</span>
      <span class="step-icon">${s.icon}</span>
      <strong>${s.title}</strong>
      <p>${s.text}</p>
    </div>`).join('');
  }

  /* ---- 助詞速查表 ---- */
  function renderParticles() {
    const box = U.$('#particleCards');
    if (!box) return;
    box.innerHTML = JPQ.PARTICLES.map(p => `
      <article class="p-card" style="--c:${p.color}">
        <div class="p-head">
          <span class="p-symbol">${p.k}</span>
          <span><strong>${p.name}</strong><em>${p.k}（${p.ro}）</em></span>
        </div>
        <ul class="p-uses">${p.uses.map(u => `<li>${U.ruby(u)}</li>`).join('')}</ul>
        <div class="p-ex"><span class="jp">${U.ruby(p.ex.jp)}</span><br><span class="zh">${p.ex.zh}</span></div>
      </article>`).join('');
  }

  /* ---- 統計 ---- */
  /* ---- 首頁學習紀錄摘要 ---- */
  function renderLearnSummary() {
    const box = U.$('#lrHomeSummary');
    if (!box || !JPQ.learn) return;
    const s = JPQ.learn.summary();
    const chips = s.total
      ? [
          `<span class="lr-chip"><b>${s.total}</b> 題</span>`,
          `<span class="lr-chip"><b>${s.right}</b> 答對</span>`,
          `<span class="lr-chip"><b>${s.rate}%</b> 正確率</span>`,
          s.streak > 1 ? `<span class="lr-chip is-streak">🔥 連續 <b>${s.streak}</b> 天</span>` : ''
        ].filter(Boolean).join('')
      : '<span class="lr-chip is-empty">還沒有紀錄，玩一局就會開始統計</span>';
    box.innerHTML = chips;
  }

  function renderStats() {
    const box = U.$('#heroStats');
    if (!box) return;

    if (JPQ.games && Object.keys(JPQ.games).length) {
      if (!JPQ.LEVELS) return;
      const total = JPQ.LEVELS.reduce((s, l) => s + l.qs.length, 0) + JPQ.SPEED_EXTRA.length +
                    JPQ.SCRAMBLE.length + JPQ.MATCH.length * 8;
      box.innerHTML = `
        <span class="stat-chip">⭐ ${JPQ.store.totalStars()} / ${JPQ.LEVELS.length * 3} 星星</span>
        <span class="stat-chip">🚩 完成 <b>${JPQ.LEVELS.filter(l => JPQ.store.levelStars(l.no) > 0).length}</b> / ${JPQ.LEVELS.length} 關</span>
        <span class="stat-chip">⚡ 最高分 <b>${JPQ.store.record('speed')}</b></span>
        <span class="stat-chip">📝 <b>${total}</b> 道練習</span>`;
      return;
    }

    const live = (JPQ.CATALOG || []).filter(g => g.status === 'live').length;
    const soon = (JPQ.CATALOG || []).length - live;
    box.innerHTML = `
      <span class="stat-chip">🎮 <b>${live}</b> 款遊戲上線</span>
      <span class="stat-chip">🌱 <b>${soon}</b> 款製作中</span>
      <span class="stat-chip">📚 免費・免安裝・離線可玩</span>
      <span class="stat-chip">🔒 進度只存在你的電腦</span>`;
  }

  /* ---- 五十音表（只有五十音專頁有） ---- */
  function renderKanaTable() {
    const box = U.$('#kanaTable');
    if (!box || !JPQ.KANA) return;

    const say = t => {
      if (typeof global.speechSynthesis === 'undefined') return;
      try {
        global.speechSynthesis.cancel();
        const u = new global.SpeechSynthesisUtterance(t);
        u.lang = 'ja-JP'; u.rate = .8;
        global.speechSynthesis.speak(u);
      } catch (e) { /* 沒語音就靜默 */ }
    };

    const head = '<div class="kana-head"><div class="kana-head-label"></div>' + ['あ段', 'い段', 'う段', 'え段', 'お段'].map(h =>
      `<div>${h}</div>`).join('') + '</div>';

    const seion = JPQ.KANA.map(r => `<div class="kana-row">
      <span class="kana-row-label">${r.row}</span>
      ${Array.from({ length: 5 }, (_, i) => {
        const c = r.cells[i];
        return c
          ? `<button class="kana-cell" data-say="${c[0]}"><b>${c[0]}</b><i>${c[1]}</i></button>`
          : '<span class="kana-cell is-void"></span>';
      }).join('')}
    </div>`).join('');

    const daku = JPQ.DAKU.map(r => `<div class="kana-row">
      <span class="kana-row-label">${r.row}</span>
      ${r.cells.map(c =>
        `<button class="kana-cell" data-say="${c[0]}"><b>${c[0]}</b><i>${c[1]}</i></button>`).join('')}
    </div>`).join('');

    const yoon = JPQ.YOON.map(([h, r]) => {
      const kata = JPQ.kana.toKatakana(h);
      return `<button class="yoon-cell" data-say="${h}"><b>${h}　${kata}</b><i>${r}</i></button>`;
    }).join('');

    box.innerHTML = `
      <div class="kana-table">${head}<div class="kana-rows">${seion}</div></div>
      <p class="kana-sub">濁音・半濁音</p>
      <div class="kana-table"><div class="kana-rows">${daku}</div></div>
      <p class="kana-sub">拗音（例）</p>
      <div class="kana-table"><div class="yoon-list">${yoon}</div></div>`;

    U.$$('[data-say]', box).forEach(b => b.addEventListener('click', () => {
      JPQ.sfx.click();
      say(b.dataset.say);
    }));
  }

/* ---- 首頁排行榜 + 學習紀錄按鈕 ---- */
  function renderSideCards() {
    const box = U.$('#lbHomeBtn');
    if (!box) return;
    box.innerHTML = `
      <div class="home-side">
        <button type="button" class="lb-home-btn" data-lb-open>
          <span class="lb-home-ico" aria-hidden="true">
            <span class="pane-thumb thumb-quiz">${JPQ.site.thumb('speed')}</span>
          </span>
          <span class="lb-home-txt">
            <strong>排行榜</strong>
            <em>看看大家在各款遊戲的最好成績</em>
          </span>
        </button>

        <button type="button" class="lb-home-btn lr-home-btn" data-lr-open>
          <span class="lb-home-ico" aria-hidden="true">
            <span class="pane-thumb thumb-kana">${JPQ.site.thumb('tiles')}</span>
          </span>
          <span class="lb-home-txt">
            <strong>學習紀錄</strong>
            <em>${U.strip ? '' : ''}看看自己的答題表現和哪個助詞還不熟</em>
            <span class="lr-home-chips" id="lrHomeSummary"></span>
          </span>
        </button>
      </div>`;

    U.$('[data-lb-open]', box).addEventListener('click', () => {
      JPQ.sfx.click();
      JPQ.lb.refresh().then(() => JPQ.lb.openBoard());
    });
    U.$('[data-lr-open]', box).addEventListener('click', () => {
      JPQ.sfx.click();
      JPQ.learn.open();
    });
    renderLearnSummary();
  }

  JPQ.home = {
    render: function () {
      renderCatalog(); renderSteps(); renderParticles(); renderStats();
      renderKanaTable(); renderSideCards();
    }
  };
})(window);
