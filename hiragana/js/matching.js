/* ==========================================================================
   matching.js — 初階：連連看（分段循序漸進 + 五十音全測驗）
   · 基礎關卡：依五十音行分關，每批 5 組，消除完自動載入下一批
   · 總複習關：46 個平假名分成 3 輪（15/15/16），
     畫面固定 5 組的「滑動視窗」，連對消除後自動補上下一組
   ========================================================================== */
(function (global) {
  'use strict';

  var U = global.App.utils;
  var el = U.el, qs = U.qs, qsa = U.qsa;

  var PAIR_COLORS = ['#ff7a9c', '#5a63d8', '#4bbd8b', '#ffb020',
                     '#9b5de5', '#00b4d8', '#f4607f', '#7cb518'];
  var HINTS_PER_ROUND = 2;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function mount(container) {
    var D = global.KanaData;
    var STAGES = D.MATCHING_STAGES;

    var state = {
      stageIndex: 0,
      mode: 'batch',      // 'batch' | 'window'
      batches: [],        // 基礎關：切成幾批
      batchIndex: 0,
      rounds: [],         // 總複習關：3 個大輪次
      roundIndex: 0,
      queue: [],          // 總複習關：等待補上的假名
      items: [],          // 畫面上目前的配對（batch 或 window 都是它）
      score: 0,
      mistakes: 0,
      combo: 0,
      bestCombo: 0,
      selected: null,
      matched: {},        // kana 字元 → 線條顏色
      hintsLeft: HINTS_PER_ROUND,
      startedAt: 0,
      ticker: null,
      locked: false,
      completed: false,
      batchSettling: false,
      unlocked: U.Store.get(D.MATCHING_UNLOCK_KEY, 1) || 1
    };

    var dom = {};
    var boundResize;
    var effects = U.createTimerScope();

    function cancelEffects() {
      effects.reset();
      if (boundResize) boundResize.cancel();
      U.Speech.stop();
    }

    /* ======================================================== 版面 */
    function buildLayout() {
      var page = el('div');

page.appendChild(el('div.page-head', [
        el('h1', [el('span.emoji', { text: '🌸' }), document.createTextNode('初階・連連看')]),
        el('p.motivation', { text: D.MOTIVATION.matching }),
        el('p.hint-text', { text: '先點左邊的平假名，再點右邊對應的羅馬字。配對成功的卡片會連線後消失；消除完一批會自動載入下一批。' })
      ]));

      var defs = [
        { key: 'score', label: 'SCORE 得分', value: '0' },
        { key: 'stage', label: 'STAGE 關卡', value: '—' },
        { key: 'prog', label: 'BATCH 進度', value: '—' },
        { key: 'left', label: 'REMAINING 剩餘', value: '0' },
        { key: 'combo', label: 'COMBO 連擊', value: '0' },
        { key: 'time', label: 'TIME 時間', value: '0:00' }
      ];
      dom.hud = {};
      dom.hudRow = el('div.hud', defs.map(function (d) {
        dom.hud[d.key] = el('span.hud__value', { text: d.value });
        return el('div.hud__item', [el('span.hud__label', { text: d.label }), dom.hud[d.key]]);
      }));

      dom.dots = el('div.batch-dots');
      dom.bar = el('div.match-progress__bar');
      dom.trackRow = el('div.batch-track', [dom.dots, el('div.match-progress', dom.bar)]);

      dom.hintBtn = el('button.btn.btn--sun.btn--sm', { type: 'button' });
      dom.hintBtn.addEventListener('click', useHint);
      dom.restartBtn = el('button.btn.btn--ghost.btn--sm', { type: 'button' }, '↺ 重玩本關');
      dom.restartBtn.addEventListener('click', function () { startStage(state.stageIndex); });
      dom.changeBtn = el('button.btn.btn--sm', { type: 'button' }, '⚙ 換關卡');
      dom.changeBtn.addEventListener('click', showPicker);

      dom.toolRow = el('div.toolbar', [
        dom.hintBtn, dom.restartBtn, dom.changeBtn,
        el('span.toolbar__spacer'),
        el('span.hint-text', { text: '連続して正解するとコンボ UP！🔥' })
      ]);

      dom.svg = document.createElementNS(SVG_NS, 'svg');
      dom.svg.setAttribute('class', 'match-lines');
      dom.svg.setAttribute('aria-hidden', 'true');

      dom.leftCol = el('div.match-col');
      dom.rightCol = el('div.match-col');
      dom.board = el('div.match-board', [dom.svg, dom.leftCol, dom.rightCol]);
      dom.stageBadge = el('span.badge.badge--matcha');
      dom.gameRow = el('div', [el('div.stage-badge-row', dom.stageBadge), el('div.panel', dom.board)]);

      /* --- 關卡選擇 --- */
      dom.stageList = el('div.stage-list');
      STAGES.forEach(function (st, i) {
        var locked = i >= state.unlocked;
        var preview = D.BASIC_POOL.filter(function (x) {
          return st.rows.indexOf(x.row) >= 0;
        }).map(function (x) { return x.k; }).join('');

        var btn = el('button.stage-opt' + (locked ? '.is-locked' : ''), {
          type: 'button', dataset: { stage: i }, disabled: locked,
          'aria-label': st.name + ' ' + st.sub + (locked ? '（尚未解鎖）' : '')
        }, [
          el('span.stage-opt__lv', { text: st.name }),
          el('span.stage-opt__kana' + (st.mode === 'window' ? '.stage-opt__kana--mini' : ''),
            { text: st.mode === 'window' ? '46 音・共 3 輪' : preview }),
          el('span.stage-opt__sub', { text: st.mode === 'window' ? D.MOTIVATION.finalStage : st.sub }),
          el('span.stage-opt__meta', { text: locked ? '🔒 通關上一關後解鎖' : '' }),
          el('span.badge' + badgeClass(st.tone), { text: st.tone })
        ]);
        btn.addEventListener('click', function () { startStage(i); });
        dom.stageList.appendChild(btn);
      });

      dom.stagePanel = el('div.panel', [
        el('p.hint-text', {
          text: '👇 選擇要練習的關卡（1～5 關依五十音行解鎖，第 6 關為五十音全測驗）：',
          style: { margin: '0 0 14px' }
        }),
        dom.stageList
      ]);

      page.appendChild(dom.hudRow);
      page.appendChild(dom.trackRow);
      page.appendChild(dom.toolRow);
      page.appendChild(dom.gameRow);
      page.appendChild(dom.stagePanel);
      container.appendChild(page);
    }

    function badgeClass(tone) {
      if (tone === '入門') return '.badge--matcha';
      if (tone === '全測驗') return '.badge--sun';
      return '.badge--indigo';
    }

    function setScreen(mode) {
      var playing = mode === 'game';
      [dom.hudRow, dom.trackRow, dom.toolRow, dom.gameRow].forEach(function (n) {
        n.style.display = playing ? '' : 'none';
      });
      dom.stagePanel.style.display = playing ? 'none' : '';
      state.locked = !playing;
    }

    function showPicker() {
      if (!effects.isActive()) return;
      cancelEffects();
      if (state.ticker) state.ticker.stop();
      refreshStageList();
      setScreen('picker');
    }

    function refreshStageList() {
      state.unlocked = U.Store.get(D.MATCHING_UNLOCK_KEY, 1) || 1;
      U.qsa('.stage-opt', dom.stageList).forEach(function (node) {
        var i = +node.dataset.stage;
        var locked = i >= state.unlocked;
        node.classList.toggle('is-locked', locked);
        node.disabled = locked;
        // 只顯示鎖定提示，不顯示任何分數紀錄
        qs('.stage-opt__meta', node).textContent = locked ? '🔒 通關上一關後解鎖' : '';
      });
    }

    /* ======================================================== 開始一關 */
    function startStage(index) {
      var stage = STAGES[index];
      if (!effects.isActive() || !stage || index >= state.unlocked) return;
      cancelEffects();
      state.completed = false;
      state.stageIndex = index;
      state.mode = stage.mode;
      state.batchIndex = 0;
      state.roundIndex = 0;
      state.score = 0;
      state.mistakes = 0;
      state.combo = 0;
      state.bestCombo = 0;
      state.batches = [];
      state.startedAt = Date.now();
      state.locked = false;

      if (state.mode === 'window') {
        state.rounds = D.buildFinalRounds();
        // 單一連續佇列：畫面固定 5 組，連對消除後從佇列補上一組，
        // 三個輪次（15/15/16）只是進度檢查點，不會讓畫面縮水。
        state.pool = state.rounds.reduce(function (a, r) { return a.concat(r.kana); }, []);
        state.items = state.pool.splice(0, D.WINDOW_SIZE);
        state.consumed = 0;
        state.roundIndex = 0;
      } else {
        state.batches = D.buildBatches(stage);
        state.items = [];
      }

      setScreen('game');
      if (state.mode === 'window') loadRound(0);
      else loadBatch(0);
    }

    /* --- 基礎關：整批換掉 --- */
    function loadBatch(i) {
      cancelEffects();
      state.batchIndex = i;
      state.items = state.batches[i] || [];
      if (!state.items.length) return;
      resetBoard();
      renderTiles();
      renderDots();
      updateHud();
      startTicker();
    }

    /* --- 總複習關：滑動視窗，只換掉消除掉的那一格 --- */
    function loadRound(i) {
      state.roundIndex = i;
      resetBoard();
      renderTiles();
      renderDots();
      updateHud();
      startTicker();
    }

    function resetBoard() {
      state.matched = {};
      state.selected = null;
      state.combo = 0;
      state.hintsLeft = HINTS_PER_ROUND;
      state.batchSettling = false;
      state.locked = false;          // 換批時一定要解鎖，否則下一批點不動
    }

    function startTicker() {
      if (state.ticker) state.ticker.stop();
      dom.hud.time.textContent = U.fmtTime(Date.now() - state.startedAt);
      state.ticker = U.createTicker(function () {
        dom.hud.time.textContent = U.fmtTime(Date.now() - state.startedAt);
      }, 500);
    }

    function renderDots() {
      U.clear(dom.dots);
      var total = state.mode === 'window'
        ? state.rounds.length
        : state.batches.length;
      var cur = state.mode === 'window' ? state.roundIndex : state.batchIndex;
      for (var i = 0; i < total; i++) {
        dom.dots.appendChild(el('span.batch-dot' + (i < cur ? '.is-done' : ''), {
          title: '第 ' + (i + 1) + ' 批／輪'
        }));
      }
    }

    function renderTiles() {
      U.clear(dom.leftCol);
      U.clear(dom.rightCol);
      U.clear(dom.svg);
      dom.leftCol.appendChild(el('div.match-col__title', { text: '平假名' }));
      dom.rightCol.appendChild(el('div.match-col__title', { text: '羅馬字' }));

      if (!state.items || !state.items.length) {
        dom.leftCol.appendChild(el('div.match-empty', { text: '全部消除！' }));
        return;
      }

      var leftOrder = U.shuffle(state.items.map(function (_, i) { return i; }));
      var rightOrder = U.shuffle(state.items.map(function (_, i) { return i; }));

      leftOrder.forEach(function (i) {
        var it = state.items[i];
        var btn = el('button.tile', {
          type: 'button', dataset: { side: 'left', k: it.k },
          text: it.k, 'aria-label': '平假名 ' + it.k
        });
        btn.addEventListener('click', function () { onLeftClick(it.k, btn); });
        dom.leftCol.appendChild(btn);
      });

      rightOrder.forEach(function (i) {
        var it = state.items[i];
        var btn = el('button.tile.tile--romaji', {
          type: 'button', dataset: { side: 'right', k: it.k },
          text: it.r, 'aria-label': '羅馬字 ' + it.r
        });
        btn.addEventListener('click', function () { onRightClick(it.k, btn); });
        dom.rightCol.appendChild(btn);
      });
    }

    function tileFor(side, kana) {
      return qs('.tile[data-side="' + side + '"][data-k="' + kana + '"]', dom.board);
    }

    /* ======================================================== 互動 */
    function onLeftClick(kana, btn) {
      if (!effects.isActive() || state.locked || state.matched[kana]) return;
      if (state.selected === kana) {
        btn.classList.remove('is-selected');
        state.selected = null;
        return;
      }
      if (state.selected !== null) {
        var prev = tileFor('left', state.selected);
        if (prev) prev.classList.remove('is-selected');
      }
      btn.classList.add('is-selected');
      state.selected = kana;
      U.Speech.speak(kana, { rate: 0.6, volume: 1 });   // 點假名即聽發音
    }

    function onRightClick(kana, btn) {
      if (!effects.isActive() || state.locked || state.matched[kana]) return;

      if (state.selected === null) {
        flash(btn, 'is-hint');
        U.toast('請先點左邊的平假名 👈', 'warn');
        return;
      }

      var leftKana = state.selected;
      var leftBtn = tileFor('left', leftKana);

      if (romajiOf(leftKana) === romajiOf(kana)) handleMatch(leftKana, leftBtn, btn);
      else handleMiss(leftKana, leftBtn, btn);
    }

    function romajiOf(kana) {
      var hit = state.items.filter(function (x) { return x.k === kana; })[0];
      return hit ? hit.r : '';
    }

    function handleMatch(kana, leftBtn, rightBtn) {
      if (state.mode === 'window') {
        // Rebuilding the window must wait until this pair has disappeared.
        state.locked = true;
        state.consumed += 1;
        state.roundIndex = 0;
        var ends = state.rounds.ends || [];
        for (var e = 0; e < ends.length; e++) {
          if (state.consumed >= ends[e]) state.roundIndex = Math.min(e + 1, state.rounds.length - 1);
        }
      }

      var color = PAIR_COLORS[Object.keys(state.matched).length % PAIR_COLORS.length];
      state.matched[kana] = color;

      [leftBtn, rightBtn].forEach(function (b) {
        b.classList.remove('is-selected');
        b.classList.add('is-matched');
      });

      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      var gain = 100 + Math.max(0, state.combo - 1) * 25;
      state.score += gain;
      state.selected = null;

      drawLine(leftBtn, rightBtn, color);
      updateHud();
      U.Speech.speak(kana, { rate: 0.6, volume: 1 });
      if (state.combo >= 3) U.toast('連擊 x' + state.combo + '！+' + gain + ' 分', 'ok', 1200);

      // 連線與卡片一起「消除」
      effects.later(function () { afterMatch(kana); }, 620);
    }

    /** 消除動畫結束後：滑動視窗補上下一組，或檢查這一輪／批是否完成 */
    function afterMatch(kana) {
      if (!dom.board || !container.contains(dom.board)) return;

      if (state.mode === 'window') {
        // 從畫面上移除這一組，並從連續佇列補上一組（畫面永遠維持 5 組）
        state.items = state.items.filter(function (x) { return x.k !== kana; });
        if (state.pool.length) state.items.push(state.pool.shift());
        U.clear(dom.svg);
        renderTiles();
        state.matched = {};
        state.selected = null;
        state.locked = false;
        updateHud();

        // 輪次檢查點（15 / 30 / 46）
        var ends = state.rounds.ends || [];
        if (ends.indexOf(state.consumed) >= 0) roundCheckpoint();
        if (!state.items.length) stageComplete();
        return;
      }

      U.clear(dom.svg);
      if (Object.keys(state.matched).length >= state.items.length) batchComplete();
    }

    function handleMiss(kana, leftBtn, rightBtn) {
      state.mistakes += 1;
      state.combo = 0;
      state.score = Math.max(0, state.score - 20);
      state.locked = true;

      flash(leftBtn, 'is-wrong');
      flash(rightBtn, 'is-wrong');
      if (leftBtn) leftBtn.classList.remove('is-selected');
      state.selected = null;

      drawLine(leftBtn, rightBtn, '#f4607f');
      updateHud();

      effects.later(function () {
        pruneLine('#f4607f');
        state.locked = false;
        updateHud();
      }, 520);
    }

    function flash(node, cls) {
      if (!node) return;
      node.classList.add(cls);
      effects.later(function () { node.classList.remove(cls); }, 460);
    }

    /* ======================================================== 連線 */
    function drawLine(a, b, color) {
      if (!a || !b) return;
      var box = dom.board.getBoundingClientRect();
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();

      var line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', ra.left + ra.width / 2 - box.left);
      line.setAttribute('y1', ra.top + ra.height / 2 - box.top);
      line.setAttribute('x2', rb.left + rb.width / 2 - box.left);
      line.setAttribute('y2', rb.top + rb.height / 2 - box.top);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '6');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-dasharray', '1 14');
      line.setAttribute('opacity', '0');
      dom.svg.appendChild(line);
      effects.later(function () {
        line.style.transition = 'opacity .25s ease';
        line.setAttribute('opacity', '0.95');
      }, 0);
    }

    function pruneLine(color) {
      qsa('line', dom.svg).forEach(function (l) {
        if (l.getAttribute('stroke') === color) l.remove();
      });
    }

    boundResize = U.debounce(function () {
      if (!effects.isActive()) return;
      if (!container.contains(dom.board)) return;
      if (dom.stagePanel.style.display !== 'none') return;
      U.clear(dom.svg);
      Object.keys(state.matched).forEach(function (k) {
        var l = tileFor('left', k), r = tileFor('right', k);
        if (l && r) drawLine(l, r, state.matched[k]);
      });
    }, 180);
    window.addEventListener('resize', boundResize);

    /* ======================================================== 提示 */
    function useHint() {
      if (!effects.isActive() || state.locked) return;
      if (state.hintsLeft <= 0) { U.toast('提示已用完囉', 'no'); return; }

      var remain = state.items.map(function (x) { return x.k; })
        .filter(function (k) { return !state.matched[k]; });
      if (!remain.length) return;

      var k = remain[0];
      var l = tileFor('left', k), r = tileFor('right', k);
      if (l && r) {
        flash(l, 'is-hint'); flash(r, 'is-hint');
        drawLine(l, r, '#ffb020');
        effects.later(function () { pruneLine('#ffb020'); }, 1300);
      }
      state.hintsLeft -= 1;
      state.score = Math.max(0, state.score - 40);
      updateHud();
    }

    /* ======================================================== HUD */
    function updateHud() {
      var stage = STAGES[state.stageIndex];
      var total = state.mode === 'window' ? 46 : state.items.length;
      var done = state.mode === 'window' ? state.consumed : Object.keys(state.matched).length;

      dom.hud.score.textContent = state.score;
      dom.hud.stage.textContent = stage.name;
      if (state.mode === 'window') {
        var r = state.roundIndex + 1;
        dom.hud.prog.textContent = '第 ' + r + ' / ' + state.rounds.length + ' 輪';
      } else {
        dom.hud.prog.textContent = (state.batchIndex + 1) + ' / ' + state.batches.length;
      }
      dom.hud.left.textContent = Math.max(0, total - done);
      dom.hud.combo.textContent = state.combo > 1 ? state.combo + ' 🔥' : '0';
      dom.bar.style.width = (total ? (done / total) * 100 : 0) + '%';

      dom.hintBtn.textContent = '💡 提示 (' + state.hintsLeft + ')';
      dom.hintBtn.disabled = state.hintsLeft <= 0 || state.locked;

      if (dom.stageBadge) {
        dom.stageBadge.textContent = stage.name + '・' + stage.sub +
          (stage.mode === 'window' ? '（滑動視窗 5 組）' : '（每批 5 組）');
      }
    }

    /* ======================================================== 完成 */
    function batchComplete() {
      if (state.batchSettling) return;   // 同一批只結算一次
      state.batchSettling = true;
      state.locked = true;

      var isLastBatch = state.batchIndex >= state.batches.length - 1;
      if (isLastBatch) return stageComplete();

      // 完成一批 → 日語鼓勵
      U.praise('batch');

      var next = state.batchIndex + 1;
      effects.later(function () { loadBatch(next); }, 1400);
    }

    function roundCheckpoint() {
      renderDots();
      U.praise('batch');
    }

    function stageComplete() {
      if (!effects.isActive() || state.completed) return;
      state.completed = true;
      cancelEffects();
      if (state.ticker) state.ticker.stop();
      state.locked = true;

      var totalMs = Date.now() - state.startedAt;
      var noMistake = state.mistakes === 0;

      var stage = STAGES[state.stageIndex];

      // 只推進關卡解鎖進度，不保存任何分數紀錄
      var isLastStage = state.stageIndex >= STAGES.length - 1;
      if (!isLastStage && state.unlocked < state.stageIndex + 2) {
        state.unlocked = state.stageIndex + 2;
        U.Store.set(D.MATCHING_UNLOCK_KEY, state.unlocked);
      }
      renderDots();
      refreshStageList();
      U.praise('stage');

      var buttons = isLastStage
        ? [
            { label: '再挑戰一次', action: function () { startStage(state.stageIndex); } },
            { label: '回到主選單', ghost: true, action: function () { location.hash = '#/'; } }
          ]
        : [
            { label: '進入下一關 →', action: function () { startStage(state.stageIndex + 1); } },
            { label: '選其他關卡', ghost: true, action: function () { showPicker(); } },
            { label: '回到主選單', ghost: true, action: function () { location.hash = '#/'; } }
          ];

      U.modal({
        emoji: isLastStage ? '🏆' : (noMistake ? '🎯' : '✨'),
        title: isLastStage ? '五十音全部制霸！' : stage.name + ' 過關！',
        body: (isLastStage
                ? '你已經把 <b>46 個平假名</b> 全部練過一輪了！'
                : (noMistake ? '全程零失誤，太厲害了！' : '整關完成，繼續往下一關前進！')),
        stats: [
          { value: stage.name, label: '關卡' },
          { value: state.mode === 'window' ? state.rounds.length + ' 輪' : state.batches.length + ' 批', label: '批次' },
          { value: noMistake ? '零失誤' : state.mistakes + ' 次', label: '本關失誤' },
          { value: state.bestCombo > 1 ? state.bestCombo + ' 連' : '—', label: '連擊' },
          { value: U.fmtTime(totalMs), label: '總用時' }
        ],
        buttons: buttons
      });
    }

    /* ======================================================== 啟動 */
    buildLayout();
    showPicker();

    return {
      destroy: function () {
        effects.destroy();
        state.locked = true;
        boundResize.cancel();
        if (state.ticker) state.ticker.stop();
        U.Speech.stop();
        window.removeEventListener('resize', boundResize);
      }
    };
  }

  global.App = global.App || {};
  global.App.matching = { mount: mount };
})(window);
