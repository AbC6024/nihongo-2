/* ==========================================================================
   memory.js — 進階：翻牌記憶遊戲
   網格：2×3（3 組）／3×4（6 組）
   規則：每次翻兩張，一張平假名 + 一張對應羅馬字即配對成功並留下
   ========================================================================== */
(function (global) {
  'use strict';

  var U = global.App.utils;
  var el = U.el, qsa = U.qsa;

  /* 配對失敗後的停頓時間（毫秒）：讓玩家有足夠時間看清楚兩張牌 */
  var MISMATCH_DELAY = 1300;
  /* 配對成功的翻牌動畫時間 */
  var MATCH_DELAY = 620;

  function mount(container) {
    var D = global.KanaData;
    var SIZES = D.MEMORY_SIZES;

    /* 預覽階段的倒數秒數（3×4 才會先亮牌） */
    var PREVIEW_SEC = 7;

    var state = {
      config: null,      // 目前選的網格設定
      cards: [],         // 卡片資料
      flips: [],         // 已翻開但未判定
      matched: 0,
      moves: 0,
      startedAt: 0,
      ticker: null,
      previewTicker: null,
      previewLeft: 0,
      previewEndsAt: 0,
      phase: 'idle',     // idle | preview | play | done
      lock: false,
      score: 0
    };

    var dom = {};
    var effects = U.createTimerScope();

    /* ======================================================== 版面 */
    function buildShell() {
      var page = el('div');

      page.appendChild(el('div.page-head', [
        el('h1', [el('span.emoji', { text: '🃏' }), document.createTextNode('進階・翻牌記憶')]),
        el('p.motivation', { text: D.MOTIVATION.memory }),
        el('div.hint-text', [
          el('p', { text: '日系和風卡牌：圓角、3D 翻轉、青海波紋與櫻花徽記，翻開大字體平假名或羅馬字。' }),
          el('p', { text: '2*3 / 3*4 兩種網格自由選' }),
          el('p', { text: '翻開假名片會自動朗讀，邊記邊聽' }),
          el('p', { text: '不配對時會停留一下，讓你看清楚兩張牌' })
        ])
      ]));

      /* 難度選擇：僅提供 2×3 與 3×4 兩種網格，全部成對 */
      dom.picker = el('div.size-picker');
      SIZES.forEach(function (s) {
        var cells = s.rows * s.cols;
        var preview = el('div.size-opt__grid');
        preview.style.gridTemplateColumns = 'repeat(' + s.cols + ', auto)';
        preview.style.justifyContent = 'center';
        for (var i = 0; i < cells; i++) {
          preview.appendChild(el('span.size-opt__cell'));
        }

        var opt = el('button.size-opt', {
          type: 'button', dataset: { size: s.rows + 'x' + s.cols },
          'aria-label': s.label + '，' + s.desc
        }, [
          preview,
          el('div.size-opt__label', { text: s.label }),
          el('div.size-opt__desc', { text: s.desc }),
          el('span.badge.badge--indigo', { text: s.tone })
        ]);
        opt.addEventListener('click', function () { selectSize(s); });
        dom.picker.appendChild(opt);
      });

      dom.sizePanel = el('div.panel', [
        el('p.hint-text', {
          text: '👇 先選擇要挑戰的網格大小，全部卡牌皆成對：',
          style: { margin: '0 0 14px' }
        }),
        dom.picker
      ]);
      page.appendChild(dom.sizePanel);

      /* 遊戲區 */
      dom.hud = {};
      [['moves', 'MOVES 步數'], ['pairs', 'PAIRS 配對'], ['score', 'SCORE 分數']]
        .forEach(function (d) {
          dom.hud[d[0]] = el('span.hud__value', { text: '0' });
        });

      dom.hudBar = el('div.hud', [
        el('div.hud__item', [el('span.hud__label', { text: 'MOVES 步數' }), dom.hud.moves]),
        el('div.hud__item', [el('span.hud__label', { text: 'PAIRS 配對' }), dom.hud.pairs]),
        el('div.hud__item', [el('span.hud__label', { text: 'SCORE 分數' }), dom.hud.score])
      ]);

      /* 右上角計時器：預覽階段顯示倒數，之後轉為通關計時 */
      dom.timerNum = el('span.timer-float__num', { text: '0:00' });
      dom.timerLabel = el('span.timer-float__label', { text: 'TIME' });
      dom.timer = el('div.timer-float', {
        role: 'timer', 'aria-live': 'off',
        'aria-label': '計時器'
      }, [dom.timerLabel, dom.timerNum]);
      dom.timer.style.display = 'none';

      dom.restartBtn = el('button.btn.btn--ghost.btn--sm', { type: 'button' }, '↺ 重新開始本局');
      dom.restartBtn.addEventListener('click', function () {
        if (state.config) startGame(state.config);
      });
      dom.changeBtn = el('button.btn.btn--sm', { type: 'button' }, '⚙ 換網格大小');
      dom.changeBtn.addEventListener('click', showPicker);

      dom.gameBar = el('div.toolbar', [
        dom.restartBtn,
        dom.changeBtn,
        el('span.toolbar__spacer'),
        el('span.hint-text', { text: '目標：用最少的步數記住所有配對 💡' })
      ]);

      dom.board = el('div.memory-board', { role: 'grid', 'aria-label': '翻牌記憶遊戲區' });
      dom.gamePanel = el('div.panel', dom.board);

      dom.gameWrap = el('div', [dom.hudBar, dom.gameBar, dom.gamePanel]);
      dom.gameWrap.style.display = 'none';
      page.appendChild(dom.gameWrap);
      container.appendChild(page);
      container.appendChild(dom.timer);   // 固定於畫面右上角
    }

    function selectSize(cfg) {
      if (!effects.isActive()) return;
      state.config = cfg;
      U.qsa('.size-opt', dom.picker).forEach(function (o) {
        o.classList.toggle('is-active', o.dataset.size === cfg.rows + 'x' + cfg.cols);
      });
      startGame(cfg);
    }

    function showPicker() {
      if (!effects.isActive()) return;
      stopTimers();
      U.Speech.stop();
      state.phase = 'idle';
      state.lock = false;
      dom.timer.style.display = 'none';
      dom.gameWrap.style.display = 'none';
      dom.sizePanel.style.display = '';
    }

    /* ======================================================== 開局 */
    /** 3×4 啟用預覽牌面（記住位置再開始） */
    function hasPreview(cfg) { return cfg.preview === true; }

    function stopTimers() {
      effects.reset();
      if (state.ticker) { state.ticker.stop(); state.ticker = null; }
      if (state.previewTicker) { state.previewTicker.stop(); state.previewTicker = null; }
    }

    /** 右上角計時器：preview 顯示倒數，play 顯示經過時間 */
    function renderTimer(phase) {
      if (phase === 'preview') {
        dom.timer.style.display = '';
        dom.timer.classList.add('is-preview');
        dom.timerLabel.textContent = '見てね！記憶開始';
        dom.timerNum.textContent = String(state.previewLeft);
      } else {
        dom.timer.style.display = '';
        dom.timer.classList.remove('is-preview');
        dom.timerLabel.textContent = 'TIME 時間';
        dom.timerNum.textContent = U.fmtTime(Date.now() - state.startedAt);
      }
    }

    /** 預覽階段：全牌亮出 + 倒數，結束後自動蓋回並開始計時 */
    function beginPreview(cfg) {
      state.phase = 'preview';
      state.lock = true;
      state.previewLeft = cfg.previewSec || PREVIEW_SEC;
      state.previewEndsAt = Date.now() + state.previewLeft * 1000;

      U.qsa('.mcard', dom.board).forEach(function (m) {
        m.classList.add('is-open', 'is-preview');
        m.disabled = true;
      });
      renderTimer('preview');

      state.previewTicker = U.createTicker(function () {
        state.previewLeft = Math.max(0, Math.ceil((state.previewEndsAt - Date.now()) / 1000));
        if (state.previewLeft > 0) {
          dom.timerNum.textContent = String(state.previewLeft);
          return;
        }
        endPreview();
      }, 1000);
    }

    function endPreview() {
      stopTimers();
      U.qsa('.mcard', dom.board).forEach(function (m) {
        m.classList.remove('is-open', 'is-preview');
        m.disabled = false;
      });
      state.phase = 'play';
      state.lock = false;
      state.startedAt = Date.now();
      renderTimer('play');
      state.ticker = U.createTicker(function () { renderTimer('play'); }, 500);
      U.toast('スタート！カードの位置を覚えてね！', 'ok', 1600);
    }

    function startGame(cfg) {
      if (!effects.isActive()) return;
      stopTimers();
      U.Speech.stop();
      dom.sizePanel.style.display = 'none';
      dom.gameWrap.style.display = '';
      state.config = cfg;

      var picked = U.sample(D.BASIC_POOL, cfg.pairs);
      state.cards = [];
      picked.forEach(function (p) {
        state.cards.push({ type: 'kana', kana: p.k, romaji: p.r, pid: p.r });
        state.cards.push({ type: 'romaji', kana: p.k, romaji: p.r, pid: p.r });
      });
      state.cards = U.shuffle(state.cards);

      state.flips = [];
      state.matched = 0;
      state.moves = 0;
      state.lock = false;
      state.startedAt = Date.now();

      renderBoard();
      updateHud();

      if (hasPreview(cfg)) {
        beginPreview(cfg);
        return;
      }

      state.phase = 'play';
      renderTimer('play');
      state.ticker = U.createTicker(function () { renderTimer('play'); }, 500);
      U.toast('先選一張卡翻開吧！', 'ok', 1400);
    }

    function renderBoard() {
      U.clear(dom.board);
      dom.board.className = 'memory-board mcard--' + state.config.rows + 'x' + state.config.cols;
      dom.board.style.gridTemplateColumns = 'repeat(' + state.config.cols + ', 1fr)';
      dom.board.style.maxWidth = Math.min(680, state.config.cols * 96) + 'px';
      dom.board.setAttribute('aria-rowcount', state.config.rows);
      dom.board.setAttribute('aria-colcount', state.config.cols);

      state.cards.forEach(function (card, i) {
        var label = card.type === 'kana' ? card.kana : card.romaji;

        var front = el('span.mcard__face.mcard__front' +
          (card.type === 'romaji' ? '.mcard__front--romaji' : ''),
          { text: label });

        var btn = el('button.mcard', {
          type: 'button',
          dataset: { i: i },
          'aria-label': '第 ' + (i + 1) + ' 張卡牌（未翻開）'
        }, [
          el('span.mcard__inner', [
            // 卡背：純 CSS 青海波 + 櫻花徽記
            el('span.mcard__face.mcard__back', el('span.mcard__emblem', { text: '?' })),
            front
          ])
        ]);
        btn.addEventListener('click', function () { flip(i, btn); });
        dom.board.appendChild(btn);
      });
    }

    /* ======================================================== 翻牌 */
    function flip(i, btn) {
      if (!effects.isActive()) return;
      if (state.phase !== 'play') return;            // 預覽倒數中不可翻牌
      if (state.lock) return;                       // 判定期間完全鎖住，任何點擊都不生效
      if (btn.classList.contains('is-done')) return;
      if (state.flips.some(function (f) { return f.i === i; })) return;

      btn.classList.add('is-open');
      btn.setAttribute('aria-label', cardLabel(state.cards[i]));
      state.flips.push({ i: i, btn: btn, card: state.cards[i] });

      // 翻開假名片時朗讀，讓玩家一邊記一邊聽
      if (state.cards[i].type === 'kana') U.Speech.speak(state.cards[i].kana, { rate: 0.6, volume: 1 });

      if (state.flips.length === 2) {
        // 兩張都已翻開：鎖定整個牌桌，之後只有結算流程能改動它們
        state.moves += 1;
        state.lock = true;
        resolvePair();
      } else {
        updateHud();   // 只更新 HUD，不重繪卡片 → 第一張牌不會閃爍
      }
    }

    function cardLabel(card) {
      if (card.type === 'kana') return card.kana;
      if (card.type === 'romaji') return card.romaji;
      return '';
    }

    function cardButton(i) {
      return dom.board.children[i];
    }

    function markDone(entry) {
      if (!entry || !entry.btn) return;
      entry.btn.classList.add('is-done');
      entry.btn.classList.remove('is-open', 'is-wrong');
      entry.btn.setAttribute('aria-label', cardLabel(entry.card) + '（已配對）');
    }

    function markHidden(entry) {
      if (!entry || !entry.btn) return;
      entry.btn.classList.remove('is-open', 'is-wrong');
      entry.btn.setAttribute('aria-label', '第 ' + (entry.i + 1) + ' 張卡牌（未翻開）');
    }

    /** 統一收尾：清空翻牌紀錄 → 執行回合動作 → 解鎖 → 更新 HUD → 檢查通關 */
    function settle(apply, delay) {
      effects.later(function () {
        state.flips = [];
        apply();
        state.lock = false;
        updateHud();
        if (state.matched >= state.config.pairs) {
          state.phase = 'finishing';
          state.lock = true;
          effects.later(gameComplete, 700);
        }
      }, delay);
    }

    function resolvePair() {
      var a = state.flips[0], b = state.flips[1];

      if (isMatch(a.card, b.card)) return lockPair(a, b);
      return releasePair(a, b);
    }

    /** 配對成功：兩張留下來 */
    function lockPair(a, b) {
      settle(function () {
        markDone(a);
        markDone(b);
        state.matched += 1;
      }, MATCH_DELAY);
    }

    /** 配對失敗：兩張牌同步保持正面，停頓 1～1.5 秒後才一起蓋回 */
    function releasePair(a, b) {
      // 同一個 tick 內一起標記，確保兩張的狀態永遠一致
      [a, b].forEach(function (f) { f.btn.classList.add('is-wrong'); });
      updateHud();
      settle(function () {
        markHidden(a);   // 兩張同步蓋回，不分先後
        markHidden(b);
      }, MISMATCH_DELAY);
    }

    /** 配對判定：一張假名 + 一張羅馬字且讀音相同 */
    function isMatch(a, b) {
      return a.pid === b.pid && a.type !== b.type;
    }

    function updateHud() {
      dom.hud.moves.textContent = state.moves;
      dom.hud.pairs.textContent = state.matched + ' / ' + state.config.pairs;
      dom.hud.score.textContent = liveScore();
    }

    /** 進行中的預估分數，結算時再加上時間獎勵 */
    function liveScore() {
      return Math.max(0, state.config.pairs * 100 - state.moves * 12);
    }

    /* ======================================================== 結算 */
    function gameComplete() {
      if (!effects.isActive() || state.phase !== 'finishing') return;
      state.phase = 'done';
      if (state.ticker) state.ticker.stop();
      state.lock = true;

      var totalMs = Date.now() - state.startedAt;
      var base = state.config.pairs * 100;
      var movePenalty = state.moves * 12;
      var timeBonus = Math.max(0, 300 - Math.round(totalMs / 500));
      var finalScore = Math.max(100, base - movePenalty + timeBonus);
      // 不保存任何分數紀錄，只在結算畫面顯示這一局的表现

      // 整局完成 → 播放一次開朗結束語音
      U.praise('stage', { ms: 3000 });

      U.modal({
        emoji: '🏆',
        title: '配對完成！',
        body: '網格 <b>' + state.config.label + '</b>' +
              (state.moves <= state.config.pairs ? '<br>完美步數！一個多余的記憶都沒有 🎯' : ''),
        stats: [
          { value: state.moves, label: '使用步數' },
          { value: state.matched + ' / ' + state.config.pairs, label: '配對組合' },
          { value: U.fmtTime(totalMs), label: '總用時' }
        ],
        buttons: [
          { label: '同尺寸再玩一次', action: function () { startGame(state.config); } },
          { label: '換個網格', ghost: true, action: function () { showPicker(); } },
          { label: '回到主選單', ghost: true, action: function () { location.hash = '#/'; } }
        ]
      });
    }

    /* ======================================================== 啟動 */
    buildShell();
    showPicker();

    return {
      destroy: function () {
        effects.destroy();
        stopTimers();
        state.phase = 'idle';
        U.Speech.stop();
      }
    };
  }

  global.App = global.App || {};
  global.App.memory = { mount: mount };
})(window);

