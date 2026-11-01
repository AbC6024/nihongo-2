/* ==========================================================================
   sentence.js — 高階：單字與句子填空
   題型 A：給羅馬字 + 中文 → 點選平假名填入空格
   題型 B：給平假名 + 中文 → 點選羅馬字填入空格（僅能點按鈕，無鍵盤輸入）
   每局固定抽 20 題（基礎單字 7 / 進階短句 7 / 完整句子 6），由簡入繁
   ========================================================================== */
(function (global) {
  'use strict';

  var U = global.App.utils;
  var el = U.el, qs = U.qs, qsa = U.qsa;

  var MASK_RATIOS = [0.4, 0.6, 0.8, 1];
  var MAX_TOKENS = 16;
  var DISTRACTORS = 5;

  function mount(container) {
    var D = global.KanaData;

    var state = {
      queue: [],          // 洗牌後的題目
      index: 0,
      mode: 'A',          // 'A' 填平假名 / 'B' 填羅馬字
      item: null,         // { q, answer[], slots[{given,value}] }
      tokens: [],         // 候選字庫 [{ value }]
      activeSlot: -1,
      status: 'input',    // 'input' | 'wrong' | 'correct'
      score: 0,
      wrongs: 0,          // 答錯題數
      hints: 0,
      cleanCount: 0,      // 一次就答對的題數
      startedAt: 0,
      ticker: null
    };

    var dom = {};
    var effects = U.createTimerScope();

    /* ======================================================== 版面 */
    function buildShell() {
      var page = el('div');

      page.appendChild(el('div.page-head', [
        el('h1', [el('span.emoji', { text: '📝' }), document.createTextNode('高階・句子填空')]),
        el('p.motivation', { text: D.MOTIVATION.sentence }),
        el('div.hint-text', [
          el('p', { text: '由簡入繁：先基礎單字（すし、ねこ），再進階短句（おはよう、すみません），最後完整句子（わたしはがくせいです）。🔊 可隨時聆聽日語發音，答對會自動朗讀一次。' }),
          el('p', { text: '兩種題型隨機出題：填平假名／填羅馬字' }),
          el('p', { text: '🔊 日語發音可重複播放；答對自動朗讀整句一次' }),
          el('p', { text: '助詞「は」依拼音規範寫作 ha，並附「發音 wa」提醒' })
        ])
      ]));

      dom.hud = {};
      [['count', 'QUESTION 進度'], ['score', 'SCORE 得分'], ['time', 'TIME 時間']]
        .forEach(function (d) {
          dom.hud[d[0]] = el('span.hud__value', { text: '—' });
        });

      page.appendChild(el('div.hud', [
        el('div.hud__item', [el('span.hud__label', { text: 'QUESTION 進度' }), dom.hud.count]),
        el('div.hud__item', [el('span.hud__label', { text: 'SCORE 得分' }), dom.hud.score]),
        el('div.hud__item', [el('span.hud__label', { text: 'TIME 時間' }), dom.hud.time])
      ]));

      dom.progressBar = el('div.q-progress__bar');
      page.appendChild(el('div.q-progress', dom.progressBar));

      var restartBtn = el('button.btn.btn--ghost.btn--sm', { type: 'button' }, '↺ 換一批題目');
      restartBtn.addEventListener('click', askRestart);

      dom.tierBar = el('div.tier-track');
      page.appendChild(el('div.toolbar', [
        restartBtn,
        el('span.toolbar__spacer'),
        el('span.hint-text', { text: '基礎單字 → 進階短句 → 完整句子，一步一步闖關；每階之內會重新洗牌 👀' })
      ]));
      page.appendChild(dom.tierBar);

      /* 題目卡 */
      dom.tier = el('span.badge');
      dom.note = el('span.badge');
      dom.zh = el('p.q-zh');
      dom.prompt = el('div.q-prompt');
      dom.kanaHint = el('div.kana-hint');
      dom.sentence = el('div.sentence');
      dom.bank = el('div.bank');
      dom.result = el('div');
      dom.checkBtn = el('button.btn.btn--matcha', { type: 'button' }, '✓ 檢查答案');
      dom.hintBtn = el('button.btn.btn--sun.btn--sm', { type: 'button' }, '💡 提示 (-30)');

      // 🔊 日語母語發音（ja-JP，慢速 + 最大音量）
      dom.speakBtn = el('button.speak-btn', {
        type: 'button',
        title: '聽日語發音',
        'aria-label': '播放本題日語發音'
      }, ['🔊', el('span.speak-btn__t', { text: '聽發音' })]);


      dom.card = el('div.q-card', [
        el('div.q-meta', [
          el('div.q-meta__tags', [dom.tier, dom.note, dom.speakBtn]),
          dom.zh
        ]),
        dom.prompt,
        dom.kanaHint,
        dom.sentence,
        el('p.bank-title', { text: '👇 先點空格，再點下方假名字卡填入' }),
        dom.bank,
        el('div.q-actions', [dom.checkBtn, dom.hintBtn]),
        dom.result
      ]);
      page.appendChild(dom.card);
      container.appendChild(page);

      dom.speakBtn.addEventListener('click', function () { speakCurrent(); });
      dom.checkBtn.addEventListener('click', onCheckClick);
      dom.hintBtn.addEventListener('click', revealOne);

      // 不支援語音的環境直接隱藏喇叭（不顯示任何說明文字）
      dom.speakBtn.style.display = U.Speech.supported() ? '' : 'none';
    }

    /** 頂端的「基礎單字 → 進階短句 → 完整句子」進度帶 */
    function renderTierTrack() {
      U.clear(dom.tierBar);
      [1, 2, 3].forEach(function (t) {
        var info = D.TIER_LABEL[t] || { text: '第 ' + t + ' 階', badge: '' };
        var done = state.queue.slice(0, state.index)
          .every(function (q) { return q.tier <= t; }) && state.index > 0 &&
          state.queue.slice(state.index).every(function (q) { return q.tier >= t; });
        dom.tierBar.appendChild(el('span.tier-step' + (done ? '.is-done' : ''), [
          el('span.tier-step__n', { text: '第 ' + t + ' 階' }),
          el('span.tier-step__t', { text: info.text })
        ]));
      });
    }

    /* ======================================================== 語音
     統一規格：volume 1.0、rate 0.6~0.7（初學者慢速，音調抑揚清楚）。
     每次 speak 前都會 cancel()，因此不會重複迴圈。
  ---------------------------------------------------------------------- */
    var speakTimer = null;
    var advanceTimer = null;

    /** 朗讀指定句子；語速音量依規格固定 */
    function speak(text, opt) {
      if (!effects.isActive()) return false;
      opt = opt || {};
      var ok = U.Speech.speak(text, {
        rate: opt.rate || 0.7, volume: 1,
        onend: typeof opt.onend === 'function' ? opt.onend : undefined
      });
      if (dom.speakBtn) {
        dom.speakBtn.classList.add('is-playing');
        effects.later(function () { dom.speakBtn.classList.remove('is-playing'); }, 900);
      }
      if (ok === false) U.toast('此瀏覽器不支援語音朗讀', 'warn');
      return ok;
    }

    /** 手動點擊喇叭：只念本題日文，不帶中文 */
    function speakCurrent() {
      if (!state.item) return false;
      return speak(state.item.q.kana);
    }

    /**
     * 答對時的播放流程：只朗讀本題日文（不夾帶任何中文或額外音效），
     * 該日文語音播放完畢後，自動切換跳轉至下一題（最後一題則結算）。
     */
    function speakResult() {
      if (!state.item) return false;
      var q = state.item.q;
      var answeredKana = q.kana;
      var advanced = false;

      var advance = function () {
        if (!effects.isActive()) return;
        if (advanced) return;
        advanced = true;
        if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
        if (!state.item || state.item.q.kana !== answeredKana) return;  // 已換題就不動作
        nextQuestion();
      };

      var ok = speak(q.kana, { rate: 0.7, onend: advance });
      // 部分語音引擎不會觸發 onend → 備援計時器（依句長給足朗讀時間）
      advanceTimer = setTimeout(advance, Math.max(1800, q.kana.length * 260));
      return ok;
    }

    /* ======================================================== 抽題 */
    function startGame() {
      if (!effects.isActive()) return;
      state.queue = buildQueue();
      state.index = 0;
      state.score = 0;
      state.wrongs = 0;
      state.hints = 0;
      state.cleanCount = 0;
      state.lastWasDirty = false;
      state.startedAt = Date.now();

      if (state.ticker) state.ticker.stop();
      state.ticker = U.createTicker(function () {
        dom.hud.time.textContent = U.fmtTime(Date.now() - state.startedAt);
      }, 500);
      dom.hud.time.textContent = '0:00';

      loadQuestion();
    }

    /**
     * 由簡入繁：階與階之間保持順序（單字 → 短句 → 完整句子），
     * 同一階之內每次重新開始都會重新洗牌。
     */
    function buildQueue() {
      var out = [];
      [1, 2, 3].forEach(function (t) {
        var pool = D.SENTENCES.filter(function (q) { return q.tier === t; });
        var n = Math.min(D.TIER_SAMPLES[t], pool.length);
        out = out.concat(U.shuffle(pool).slice(0, n));
      });
      return out;   // 由簡入繁：基礎單字 → 進階短句 → 完整句子
    }

    function loadQuestion() {
      effects.reset();
      // 換題時取消尚未觸發的自動朗讀／自動跳題，避免念到上一題
      if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
      if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
      U.Speech.stop();

      var q = state.queue[state.index];
      // 兩種題型隨機出題：填平假名（A）／填羅馬字（B）
      state.mode = Math.random() < 0.5 ? 'A' : 'B';
      var answer = state.mode === 'A' ? q.syll.slice() : q.romaji.slice();

      var blanks = pickBlanks(answer.length, U.pick(MASK_RATIOS));
      var blankSet = {};
      blanks.forEach(function (i) { blankSet[i] = true; });

      state.item = {
        q: q,
        answer: answer,
        slots: answer.map(function (v, i) {
          return blankSet[i] ? { given: false, value: '' } : { given: true, value: v };
        })
      };
      state.tokens = buildTokenBank(answer, blankSet);
      state.activeSlot = firstEmpty();
      state.status = 'input';

      renderQuestion();
    }

    function pickBlanks(total, ratio) {
      var n = Math.max(1, Math.min(total, Math.round(total * ratio)));
      var all = [];
      for (var i = 0; i < total; i++) all.push(i);
      return U.shuffle(all).slice(0, n).sort(function (a, b) { return a - b; });
    }

    /** 候選字庫 = 需要的字（去重）+ 干擾字，總數上限 MAX_TOKENS */
    function buildTokenBank(answer, blankSet) {
      var needed = [];
      answer.forEach(function (v, i) {
        if (blankSet[i] && needed.indexOf(v) < 0) needed.push(v);
      });

      var pool = state.mode === 'A'
        ? D.SYLL_POOL.filter(function (k) { return needed.indexOf(k) < 0; })
        : D.ROMAJI_POOL.filter(function (r) { return needed.indexOf(r) < 0; });
      var room = Math.max(0, Math.min(MAX_TOKENS - needed.length, DISTRACTORS));
      var bank = needed.map(function (v) { return { value: v }; })
        .concat(U.sample(pool, room).map(function (v) { return { value: v }; }));
      return U.shuffle(bank);
    }

    /* ======================================================== 渲染 */
    function renderQuestion() {
      var q = state.item.q;
      var isKanaMode = state.mode === 'A';

      dom.zh.textContent = q.zh;
      dom.note.textContent = q.note || '';

      var tierInfo = D.TIER_LABEL[q.tier] || { text: '', badge: '' };
      dom.tier.textContent = tierInfo.text;
      dom.tier.className = 'badge ' + tierInfo.badge;

      dom.prompt.innerHTML = isKanaMode
        ? '請依<b>羅馬字</b>寫出對應的平假名：<br><em>' + q.romaji.join(' ') + '</em>'
        : '請依<b>平假名</b>寫出對應的羅馬字：<br><em>' + q.kana + '</em>';

      // 助詞「は」的拼音提醒：發音 wa，拼音寫作 ha
      var hasHa = q.syll.indexOf('は') >= 0;
      dom.kanaHint.innerHTML = hasHa
        ? '💡 <b>は</b>：' + D.HA_NOTE
        : '';
      dom.kanaHint.style.display = hasHa ? '' : 'none';

      /* --- 句子 --- */
      U.clear(dom.sentence);
      dom.sentence.className = isKanaMode ? 'sentence' : 'sentence sentence--word';

      state.item.slots.forEach(function (slot, i) {
        var btn = el('button.slot', {
          type: 'button',
          dataset: { i: i },
          text: slot.value,
          'aria-label': slot.given ? '第 ' + (i + 1) + ' 格：' + slot.value : '第 ' + (i + 1) + ' 格，空格'
        });
        if (slot.given) {
          btn.classList.add('slot--given');
          btn.disabled = true;
        } else {
          btn.classList.add('is-empty');
          btn.addEventListener('click', function () { onSlotClick(i); });
        }
        dom.sentence.appendChild(btn);
        if (!isKanaMode) dom.sentence.appendChild(el('span.word-gap'));
      });

      /* --- 字庫 --- */
      U.clear(dom.bank);
      state.tokens.forEach(function (t, i) {
        var btn = el('button.token', {
          type: 'button', dataset: { tk: i },
          text: t.value, 'aria-label': '字卡 ' + t.value
        });
        if (state.mode === 'B') btn.classList.add('token--romaji');
        btn.addEventListener('click', function () { placeToken(i); });
        dom.bank.appendChild(btn);
      });

      /* --- 按鈕狀態 --- */
      dom.checkBtn.textContent = '✓ 檢查答案';
      dom.checkBtn.className = 'btn btn--matcha';
      dom.checkBtn.disabled = false;
      dom.hintBtn.disabled = false;
      dom.result.className = '';
      dom.result.textContent = '';

      syncUI();
      updateHud();
      renderTierTrack();
    }

    function slotEl(i) { return qs('.slot[data-i="' + i + '"]', dom.sentence); }

    /* ======================================================== 互動 */
    function onSlotClick(i) {
      if (state.status === 'correct') return;
      var slot = state.item.slots[i];
      if (slot.given) return;

      if (slot.value) {
        // 點已填入的格子 → 清空
        slot.value = '';
        var node = slotEl(i);
        node.textContent = '';
        node.className = 'slot is-empty';
        if (state.status === 'wrong') state.status = 'input';
        dom.result.className = '';
        dom.result.textContent = '';
        dom.checkBtn.textContent = '✓ 檢查答案';
        dom.checkBtn.className = 'btn btn--matcha';
      }
      setActive(i);
      syncUI();
    }

    function setActive(i) {
      state.activeSlot = i;
      qsa('.slot.is-active', dom.sentence).forEach(function (n) { n.classList.remove('is-active'); });
      if (i >= 0 && state.item.slots[i] && !state.item.slots[i].given) {
        slotEl(i).classList.add('is-active');
      }
    }

    function placeToken(tk) {
      if (state.status === 'correct') return;
      var t = state.tokens[tk];
      if (!t || !tokenAvailable(tk)) return;

      var i = state.activeSlot;
      if (i < 0 || state.item.slots[i].given) {
        i = firstEmpty();
        if (i < 0) { U.toast('空格都填滿囉，按「檢查答案」✓', 'warn'); return; }
      }

      state.item.slots[i].value = t.value;
      var node = slotEl(i);
      node.textContent = t.value;
      node.classList.remove('is-empty');
      node.classList.add('is-filled');

      var next = firstEmpty();
      if (next >= 0) setActive(next);
      else setActive(-1);
      syncUI();
    }

    /** 這個字卡是否還能被使用（干擾字永遠可用） */
/** 這個字卡是否還能被使用（干擾字永遠可用） */
    function tokenAvailable(tk) {
      var v = state.tokens[tk].value;
      var need = 0, used = 0;
      state.item.slots.forEach(function (s, i) {
        if (s.given) return;
        if (state.item.answer[i] === v) need++;
        if (s.value === v) used++;
      });
      if (need === 0) return true;          // 純干擾項：一直可點
      return used < need;
    }

    function syncUI() {
      qsa('.token', dom.bank).forEach(function (btn) {
        btn.classList.toggle('is-used', !tokenAvailable(+btn.dataset.tk));
      });
    }

    function firstEmpty() {
      for (var i = 0; i < state.item.slots.length; i++) {
        if (!state.item.slots[i].given && !state.item.slots[i].value) return i;
      }
      return -1;
    }

    /* ======================================================== 檢核 */
    function onCheckClick() {
      if (state.status === 'correct') return nextQuestion();
      if (state.status === 'wrong') return retryQuestion();
      checkAnswer();
    }

    /** 讀音等價：は/わ、を/お 等寫法差異視為正確 */
    function isAnswerCorrect(user, expected) {
      if (!user) return false;
      return state.mode === 'A'
        ? D.kanaEquivalent(user, expected)
        : D.romajiEquivalent(user, expected);
    }

    function checkAnswer() {
      var blanks = state.item.slots.filter(function (s) { return !s.given; });
      var missing = blanks.filter(function (s) { return !s.value; }).length;
      if (missing) {
        U.toast('還有 ' + missing + ' 個空格沒填哦', 'no');
        dom.result.className = 'result-note result-note--no';
        dom.result.textContent = '請先把所有空格填滿再檢查。';
        return;
      }

      var wrong = [];
      state.item.slots.forEach(function (s, i) {
        if (s.given) return;
        var node = slotEl(i);
        if (isAnswerCorrect(s.value, state.item.answer[i])) {
          node.classList.add('is-correct');
        } else {
          node.classList.add('is-wrong');
          wrong.push(i);
        }
      });

      if (!wrong.length) return passQuestion();
      return failQuestion(wrong);
    }

    function passQuestion() {
      state.status = 'correct';
      var gain = state.lastWasDirty ? 60 : 120;
      state.score += gain;
      if (!state.lastWasDirty) state.cleanCount += 1;

      dom.result.className = 'result-note result-note--ok';
      dom.result.textContent = (state.lastWasDirty
        ? '✅ 答對了！修改過所以 +' + gain + ' 分'
        : '🎉 一次就全對！+' + gain + ' 分');
      state.lastWasDirty = false;

      dom.checkBtn.disabled = true;
      dom.checkBtn.textContent = '🔊 播放中…';
      dom.checkBtn.className = 'btn btn--indigo';
      dom.hintBtn.disabled = true;
      syncUI();
      updateHud();

      // 答對 → 只播放一次本題日文；播放完畢自動前往下一題
      if (speakTimer) clearTimeout(speakTimer);
      var answered = state.item.q.kana;
      speakTimer = setTimeout(function () {
        speakTimer = null;
        if (!state.item || state.item.q.kana !== answered) return;  // 已換題就不播
        speakResult();
      }, 320);
    }

    function failQuestion(wrongIdx) {
      state.status = 'wrong';
      state.wrongs += 1;
      state.lastWasDirty = true;
      state.score = Math.max(0, state.score - 20);
      U.toast('有 ' + wrongIdx.length + ' 個字不對，再試一次！', 'no');

      dom.result.className = 'result-note result-note--no';
      dom.result.innerHTML = '❌ 有 <b>' + wrongIdx.length + '</b> 個位置不正確。' +
        '點紅色的格子可清空重填，或按「提示」直接看答案。';
      dom.checkBtn.textContent = '↻ 清空重填';
      dom.checkBtn.className = 'btn btn--ghost';
      updateHud();
    }

    function retryQuestion() {
      var nodes = qsa('.slot.is-wrong', dom.sentence);
      nodes.forEach(function (n) {
        var i = +n.dataset.i;
        state.item.slots[i].value = '';
        n.textContent = '';
        n.className = 'slot is-empty';
      });
      state.status = 'input';
      state.activeSlot = firstEmpty();
      setActive(state.activeSlot);
      dom.result.className = '';
      dom.result.textContent = '';
      dom.checkBtn.textContent = '✓ 檢查答案';
      dom.checkBtn.className = 'btn btn--matcha';
      dom.hintBtn.disabled = false;
      syncUI();
      updateHud();
    }

    function revealOne() {
      if (state.status === 'correct') return;
      var target = -1;
      state.item.slots.forEach(function (s, i) {
        if (target < 0 && !s.given && !isAnswerCorrect(s.value, state.item.answer[i])) target = i;
      });
      if (target < 0) { U.toast('目前沒有需要提示的字了', 'warn'); return; }

      state.item.slots[target].value = state.item.answer[target];
      var node = slotEl(target);
      node.textContent = state.item.answer[target];
      node.className = 'slot is-revealed';
      effects.later(function () {
        if (node.classList.contains('is-revealed')) node.className = 'slot';
      }, 1000);

      state.hints += 1;
      state.lastWasDirty = true;
      if (state.status === 'wrong') {
        state.status = 'input';
        qsa('.slot.is-wrong', dom.sentence).forEach(function (slot) { slot.classList.remove('is-wrong'); });
        dom.checkBtn.textContent = '✓ 檢查答案';
        dom.checkBtn.className = 'btn btn--matcha';
      }
      state.score = Math.max(0, state.score - 30);
      dom.result.className = 'result-note result-note--hint';
      dom.result.textContent = '💡 第 ' + (target + 1) + ' 格是「' + state.item.answer[target] + '」（-30 分）';

      var next = firstEmpty();
      setActive(next);
      syncUI();
      updateHud();
    }

    function nextQuestion() {
      if (state.index >= state.queue.length - 1) return gameComplete();
      state.index += 1;
      state.lastWasDirty = false;
      loadQuestion();
    }

    /* ======================================================== HUD / 結算 */
    function updateHud() {
      if (!state.item) return;
      dom.hud.count.textContent = (state.index + 1) + ' / ' + state.queue.length;
      dom.hud.score.textContent = state.score;
      dom.progressBar.style.width = (state.index / state.queue.length * 100) + '%';
    }

    function gameComplete() {
      if (state.ticker) state.ticker.stop();
      var totalMs = Date.now() - state.startedAt;
      var accuracy = Math.round(state.cleanCount / state.queue.length * 100);
      // 不保存任何分數紀錄

      // 全部答完 → 播放一次開朗結束語音
      U.praise('stage', { ms: 3000 });

      dom.progressBar.style.width = '100%';
      U.modal({
        emoji: '📚',
        title: '全部答完！',
        body: accuracy === 100
          ? '全部一次就答對，五十音已經很熟了！'
          : (accuracy >= 60 ? '順利完成，再練一輪會更熟。' : '完成！把錯的地方多看幾次就會記住了。'),
        stats: [
          { value: state.queue.length, label: '完成題數' },
          { value: accuracy + '%', label: '一次答對率' },
          { value: state.wrongs ? state.wrongs + ' 題' : '無', label: '需重試' },
          { value: state.hints ? state.hints + ' 次' : '無', label: '使用提示' },
          { value: U.fmtTime(totalMs), label: '總用時' }
        ],
        buttons: [
          { label: '再抽一批題目', action: function () { startGame(); } },
          { label: '回到主選單', ghost: true, action: function () { location.hash = '#/'; } }
        ]
      });
    }

    function askRestart() {
      U.confirmModal({
        emoji: '↺',
        title: '要換一批題目嗎？',
        body: '會重新從題庫抽題並打亂順序，目前分數將歸零。',
        okLabel: '重新抽題'
      }).then(function (ok) { if (ok) startGame(); });
    }

    /* ======================================================== 啟動 */
    buildShell();
    startGame();

    return {
      destroy: function () {
        effects.destroy();
        if (state.ticker) state.ticker.stop();
        if (speakTimer) clearTimeout(speakTimer);
        if (advanceTimer) clearTimeout(advanceTimer);
        U.Speech.stop();
      }
    };
  }

  global.App = global.App || {};
  global.App.sentence = { mount: mount };
})(window);
