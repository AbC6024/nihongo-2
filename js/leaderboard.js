/* =========================================================
   排行榜 — API 客戶端 + 面板
   伺服器沒有開（例如直接用 file:// 打開）時會自動隱藏
   ========================================================= */
window.JPQ = window.JPQ || {};

/* 各遊戲的排行榜設定 */
JPQ.LB_GAMES = {
  quiz:          { label: '選擇題闖關', unit: '星星',   desc: '六關總星星數' },
  speed:         { label: '快速搶答',   unit: '分',     desc: '45 秒內的分數' },
  scramble:      { label: '句子重排',   unit: '句',     desc: '排對的句子數' },
  match:         { label: '助詞配對',   unit: '分',     desc: '三回合總分' },
  'kana-order':  { label: '五十音順序', unit: '連勝',   desc: '最高連勝' },
  'kana-convert':{ label: '平假名⇄片假名', unit: '連勝', desc: '最高連勝' },
  'kana-listen': { label: '聽音選字',   unit: '連勝',   desc: '最高連勝' }
};

JPQ.lb = {
  ok: null,               /* 伺服器 API 是否可用 */
  ephemeral: false,       /* 成績會不會在主機重啟後消失 */
  boards: {},
  names: {},              /* 記住每台裝置上次輸入的暱稱 */

  /* ---------- API ---------- */
  probe: async function () {
    try {
      const r = await fetch('api/leaderboard', { cache: 'no-store' });
      const j = await r.json();
      this.ok = !!j.ok;
      this.ephemeral = !!j.ephemeral;
      if (j.ok) { this.boards = j.boards || {}; }
    } catch (e) { this.ok = false; }
    return this.ok;
  },

  refresh: async function () {
    try {
      const r = await fetch('api/leaderboard', { cache: 'no-store' });
      const j = await r.json();
      this.ok = !!j.ok;
      this.ephemeral = !!j.ephemeral;
      if (this.ok) this.boards = j.boards || {};
    } catch (e) { this.ok = false; }
    return this.ok;
  },

  submit: async function (game, name, score, detail) {
    if (this.ok === false) return { ok: false, offline: true };
    const res = await fetch('api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: game, name: name, score: score, detail: detail || '' })
    });
    const j = await res.json();
    if (j.ok) {
      this.boards = j.boards || this.boards;
      this.rememberName(game, name);          /* 記住這次用的暱稱，下次不用再打 */
    }
    return j;
  },

  /* ---------- 暱稱 ---------- */
  rememberedName: function (game) {
    try { return localStorage.getItem('jpq.nick.' + game) || ''; } catch (e) { return ''; }
  },
  rememberName: function (game, name) {
    this.names[game] = name;
    try { localStorage.setItem('jpq.nick.' + game, name); } catch (e) {}
  },

  /* ---------- 面板 ---------- */
  renderPanel: function (el) {
    const U = JPQ.util;
    const esc = U.escapeHTML;
    if (!el) return;
    if (this.ok === false) {
      el.innerHTML = `<div class="lb-off">
        <p><b>排行榜目前開不起來</b></p>
        <p>需要在專案資料夾執行 <code>node server.js</code>，再用 <code>http://localhost:8000</code> 開啟才會有排行榜。<br>
        直接雙擊 index.html 用檔案方式開啟時沒有伺服器，成績就只能存在這台電腦。</p>
      </div>`;
      return;
    }

    const keys = Object.keys(JPQ.LB_GAMES);
    const active = this.activeGame && keys.includes(this.activeGame) ? this.activeGame : keys[0];
    this.activeGame = active;

    const tabs = keys.map(k => `<button class="lb-tab${k === active ? ' on' : ''}" data-game="${k}">${JPQ.LB_GAMES[k].label}</button>`).join('');
    const list = this.boards[active] || [];
    const meta = JPQ.LB_GAMES[active];

    const rows = list.length ? list.map(e => `<li class="lb-row${e.rank <= 3 ? ' top' : ''}">
        <span class="lb-rank">${e.rank}</span>
        <span class="lb-name">${esc(U.strip ? U.strip(e.name) : e.name)}</span>
        <span class="lb-score">${e.score}<em>${meta.unit}</em></span>
        ${e.detail ? `<span class="lb-detail">${esc(e.detail)}</span>` : ''}
      </li>`).join('')
      : '<li class="lb-empty">還沒有人登記，自己來當第一個吧！</li>';

    /* 免費方案的磁碟是暫存的，要先講清楚 */
    const warn = this.ephemeral ? `<div class="lb-warn">
        <b>ℹ 這份排行榜是暫時的</b>
        <p>這個網站目前跑在免費空間上，伺服器重啟後成績就會被清空。<br>
        遊戲和你的個人進度（存在瀏覽器裡）都不受影響。</p>
      </div>` : '';

    el.innerHTML = `
      ${warn}
      <div class="lb-tabs">${tabs}</div>
      <p class="lb-hint">${meta.desc}　·　同一個暱稱只留最高分</p>
      <ol class="lb-list">${rows}</ol>`;

    U.$$('.lb-tab', el).forEach(b => b.addEventListener('click', () => {
      this.activeGame = b.dataset.game;
      this.renderPanel(el);
    }));
  },

  /* ---------- 登記對話框 ---------- */
  /* 玩完之後呼叫：offer('speed', 120, '答對 12 題') */
  offer: function (game, score, detail) {
    const U = JPQ.util;
    const esc = U.escapeHTML;
    if (this.ok === false) {
      JPQ.modal.show({
        title: '排行榜開不起來',
        html: '<p>要先在專案資料夾執行 <b>node server.js</b>，<br>並用 http://localhost:8000 開啟網站。</p>',
        actions: [{ label: '知道了', onClick: () => JPQ.modal.close() }]
      });
      return;
    }

    const meta = JPQ.LB_GAMES[game] || { label: '遊戲', unit: '' };
    const mine = (this.boards[game] || []).find(e => e.name === this.rememberedName(game));

    JPQ.modal.show({
      title: '登記排行榜',
      html: `
        <p style="margin-bottom:14px">遊戲：<b>${meta.label}</b>　成績：<b style="font-size:22px;color:#6f66a8">${score}</b> ${meta.unit}</p>
        <label style="display:block;text-align:left;font-size:13px;font-weight:700;color:#6a7096;margin-bottom:6px">你的暱稱（最多 16 字）</label>
        <input id="lbName" type="text" maxlength="16" placeholder="例如：小明"
          value="${esc(this.rememberedName(game))}"
          style="width:100%;padding:12px 14px;border-radius:12px;border:2px solid #e6e8f2;font-size:16px;font-family:inherit;text-align:center">
        <p class="lb-msg" style="margin-top:12px;font-size:13.5px;min-height:20px"></p>`,
      actions: [
        { label: '放棄', cls: 'grey', onClick: () => JPQ.modal.close() },
        { label: '送出成績', onClick: () => {
            const input = document.getElementById('lbName');
            const name = (input ? input.value : '').trim().slice(0, 16);
            const msg = document.querySelector('.lb-msg');
            if (!name) { if (msg) { msg.textContent = '請先輸入暱稱'; msg.style.color = '#cc3f55'; } return; }
            if (msg) { msg.textContent = '送出中…'; msg.style.color = '#8b91ad'; }
            this.submit(game, name, score, detail).then(j => {
              JPQ.modal.close();
              if (!j.ok) {
                JPQ.modal.show({ title: '送出失敗', html: '<p>' + esc(j.error || '請稍後再試') + '</p>',
                  actions: [{ label: '好', onClick: () => JPQ.modal.close() }] });
                return;
              }
              JPQ.sfx.levelup();
              JPQ.fx.center();
              JPQ.modal.show({
                title: j.rank ? '第 ' + j.rank + ' 名！' : '已登記',
                html: `<p style="font-size:17px;margin-bottom:6px"><b>${esc(name)}</b> 在「${meta.label}」得到 <b style="color:#6f66a8">${score}</b> ${meta.unit}</p>
                  <p style="font-size:13.5px;color:#8b91ad">目前共 ${j.total} 筆紀錄${j.improved ? '　·　刷新了個人最佳' : ''}</p>
                  ${this.ephemeral ? '<p style="font-size:12.5px;color:#b0894a;margin-top:8px">提醒：這個免費空間重啟後成績會被清空，這次登記只是體驗看看。</p>' : ''}`,
                actions: [
                  { label: '看排行榜', onClick: () => { JPQ.modal.close(); this.refresh().then(() => this.paintAll()); this.openBoard(game); } },
                  { label: '關閉', cls: 'grey', onClick: () => JPQ.modal.close() }
                ]
              });
              this.refresh().then(() => this.paintAll());
            }).catch(err => {
              if (msg) { msg.textContent = '連線失敗：' + err.message; msg.style.color = '#cc3f55'; }
            });
          } }
      ]
    });
    void mine; void U;
  },

  /* 直接用對話框顯示排行榜，玩遊戲中也能看 */
  openBoard: function (game) {
    const U = JPQ.util;
    const esc = U.escapeHTML;
    if (this.ok === false) {
      JPQ.modal.show({
        title: '排行榜開不起來',
        html: '<p>要先在專案資料夾執行 <b>node server.js</b>，<br>並用 http://localhost:8000 開啟網站。</p>',
        actions: [{ label: '知道了', onClick: () => JPQ.modal.close() }]
      });
      return;
    }
    if (game && JPQ.LB_GAMES[game]) this.activeGame = game;

    const keys = Object.keys(JPQ.LB_GAMES);
    const active = this.activeGame && keys.includes(this.activeGame) ? this.activeGame : keys[0];
    const list = this.boards[active] || [];
    const meta = JPQ.LB_GAMES[active];
    const myName = this.rememberedName(active);

    const tabs = keys.map(k => `<button class="lb-tab${k === active ? ' on' : ''}" data-game="${k}">${JPQ.LB_GAMES[k].label}</button>`).join('');
    const rows = list.length ? list.map(e => `<li class="lb-row${e.rank <= 3 ? ' top' : ''}${e.name === myName ? ' me' : ''}">
        <span class="lb-rank">${e.rank}</span>
        <span class="lb-name">${esc(U.strip ? U.strip(e.name) : e.name)}</span>
        <span class="lb-score">${e.score}<em>${meta.unit}</em></span>
        ${e.detail ? `<span class="lb-detail">${esc(e.detail)}</span>` : ''}
      </li>`).join('')
      : '<li class="lb-empty">還沒有人登記，自己來當第一個吧！</li>';

    const box = document.createElement('div');
    box.className = 'lb-box';
    box.innerHTML = `
      ${this.ephemeral ? `<div class="lb-warn"><b>ℹ 這份排行榜是暫時的</b><p>這個網站目前跑在免費空間上，伺服器重啟後成績就會被清空。<br>遊戲和你的個人進度（存在瀏覽器裡）都不受影響。</p></div>` : ''}
      <div class="lb-tabs">${tabs}</div>
      <p class="lb-hint">${meta.desc}　·　同一個暱稱只留最高分</p>
      <ol class="lb-list">${rows}</ol>`;

    JPQ.modal.show({
      title: '排行榜',
      html: '<div id="lbModalBody"></div>',
      wide: true,
      actions: [{ label: '關閉', cls: 'grey', onClick: () => JPQ.modal.close() }]
    });

    const host = document.getElementById('lbModalBody');
    if (host) host.appendChild(box);

    U.$$('.lb-tab', box).forEach(b => b.addEventListener('click', () => {
      this.activeGame = b.dataset.game;
      this.openBoard(this.activeGame);
    }));
  },

  /* 頁面上所有排行榜區塊一起重畫 */
  paintAll: function () {
    const U = JPQ.util;
    U.$$('[data-leaderboard]').forEach(el => {
      el.dataset.game = this.activeGame || '';
      this.renderPanel(el);
    });
  },

  /* 頁面載入後呼叫 */
  init: function () {
    const U = JPQ.util;
    const boxes = U.$$('[data-leaderboard]');
    const bests = U.$$('[data-mybest]');
    if (!boxes.length && !bests.length) return;
    boxes.forEach(el => { el.innerHTML = '<p class="lb-loading">載入排行榜…</p>'; });
    this.refresh().then(() => {
      boxes.forEach(el => this.renderPanel(el));
      bests.forEach(el => this.renderMyBest(el));
    });
  },

  /* 沒有結算視窗的遊戲（無限題）：在頁面上登記自己的最佳成績 */
  renderMyBest: function (el) {
    const U = JPQ.util;
    const list = (el.dataset.mybest || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!list.length) return;
    el.innerHTML = list.map(game => {
      const meta = JPQ.LB_GAMES[game] || { label: game, unit: '' };
      const best = JPQ.store.record(game + '-best');
      const mine = (this.boards[game] || []).find(e => e.name === this.rememberedName(game));
      return `<div class="lb-mine">
        <div class="lb-mine-txt">
          <strong>${meta.label}</strong>
          <span>${best ? '最佳 <b>' + best + '</b> ' + meta.unit : '還沒有成績，玩幾題再回來登記'}</span>
          ${mine ? '<em>目前在第 ' + mine.rank + ' 名</em>' : ''}
        </div>
        <button class="btn ghost lb-mine-btn" data-submit="${game}"
          ${best ? '' : 'disabled'}>🏆 登記</button>
      </div>`;
    }).join('');

    U.$$('[data-submit]', el).forEach(b => b.addEventListener('click', () => {
      const game = b.dataset.submit;
      const meta = JPQ.LB_GAMES[game];
      JPQ.lb.offer(game, JPQ.store.record(game + '-best'), '個人最佳');
      void meta;
    }));
  }
};
