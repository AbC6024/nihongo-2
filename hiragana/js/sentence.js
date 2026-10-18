/* ==========================================================================
   sentence.js — 高階：句子拼湊與填空
   模式 A：給羅馬字 + 中文 → 點選平假名填入空格
   模式 B：給平假名 + 中文 → 點選羅馬字填入空格
   每次開始都會重新抽題、洗牌題序與隨機挖空
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
      completed: false,
      startedAt: 0,
      ticker: null
    };

    var dom = {};
    var effects = U.createTimerScope();
    var restartPending = false;

    /* ======================================================== 版面 */
    function buildShell() {
      var page = el('div');

      page.appendChild(el('div.page-head', [
        el('h1', [el('span.emoji', { text: '📝' }), document.createTextNode('高階・句子填空')]),
        el('p.motivation', { text: D.MOTIVATION.sentence }),
        el('p.hint-text', { text: '看著羅馬字或中文意思，把句子補完整。先點空格，再點下方的字卡填入；按「檢查」後必須完全正確才能過關！' })
      ]));

      dom.hud = {};
      [['count', 'QUESTION 進度'], ['score', 'SCORE 得分'], ['mode', 'MODE 題型'], ['time', 'TIME 時間']]
        .forEach(function (d) {
          dom.hud[d[0]] = el('span.hud__value', { text: '—' });
        });

      page.appendChild(el('div.hud', [
        el('div.hud__item', [el('span.hud__label', { text: 'QUESTION 進度' }), dom.hud.count]),
        el('div.hud__item', [el('span.hud__label', { text: 'SCORE 得分' }), dom.hud.score]),
        el('div.hud__item', [el('span.hud__label', { text: 'MODE 題型' }), dom.hud.mode]),
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
        el('span.hint-text', { text: '單字 → 基礎短句 → 完整句子，一步一步闖關；每階之內會重新洗牌 👀' })
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
      dom.extra = el('div');
      dom.result = el('div');
      dom.checkBtn = el('button.btn.btn--matcha', { type: 'button' }, '✓ 檢查答案');
      dom.hintBtn = el('button.btn.btn--sun.btn--sm', { type: 'button' }, '💡 提示 (-30)');

      // 🔊 日語母語發音（ja-JP，慢速 + 最大音量）
      dom.speakBtn = el('button.speak-btn', {
        type: 'button',
        title: '聽日語發音',
        'aria-label': '播放本句日語發音'
      }, ['🔊', el('span.speak-btn__t', { text: '聽發音' })]);


      dom.card = el('div.q-card', [
        el('div.q-meta', [
          el('div.q-meta__tags', [dom.tier, dom.note, dom.speakBtn]),
          dom.zh
        ]),
        dom.prompt,
        dom.kanaHint,
        dom.sentence,
        el('p.bank-title', { text: '👇 先點空格，再點下方字卡填入' }),
        dom.bank,
        dom.extra,
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

    /** 頂端的「單字 → 短句 → 句子」進度帶 */
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

    /** 朗讀指定句子；語速音量依規格固定 */
    function speak(text, opt) {
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
      if (!effects.isActive() || !state.item) return false;
      return speak(state.item.q.kana);
    }

    /**
     * 答對時的播放流程：先朗讀本句（日文＋中文），結束後再播一句日語鼓勵。
     * 鼓勵語音只會播放一次，且一定在句子之後，不會互相打斷。
     */
    function speakResult() {
      if (!state.item) return false;
      var answered = state.item;
      var q = state.item.q;
      var praised = false;
      function doPraise() {
        if (!effects.isActive() || state.item !== answered || state.completed || praised) return;
        praised = true;
        U.praise('answer');
      }
      var ok = speak(q.kana + '。' + q.zh, {
        rate: 0.7,
        onend: doPraise
      });
      // 部分語音引擎不會觸發 onend → 備援計時器
      effects.later(doPraise, 2600);
      return ok;
    }

    /* ======================================================== 抽題 */
    function startGame() {
      if (!effects.isActive()) return;
      state.completed = false;
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
      var tiers = {};
      D.SENTENCES.forEach(function (q) {
        (tiers[q.tier] = tiers[q.tier] || []).push(q);
      });
      var out = [];
      Object.keys(tiers).sort(function (a, b) { return +a - +b; })
        .forEach(function (t) { out = out.concat(U.shuffle(tiers[t])); });
      return out;
    }

    function loadQuestion() {
      effects.reset();
      // 換題時取消尚未觸發的自動朗讀，避免念到上一題
      if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
      U.Speech.stop();
      dom.speakBtn.classList.remove('is-playing');

      var q = state.queue[state.index];
      state.mode = Math.random() < 0.5 ? 'A' : 'B';
      // 模式 A 以「音節」為單位（きょう / って 各算一格），模式 B 以羅馬字音節為單位
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

      /* --- 模式 B：打字輸入 --- */
      U.clear(dom.extra);
      dom.extra.className = '';
      if (state.mode === 'B') {
        var input = el('input', {
          type: 'text', placeholder: '例如：wa', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false'
        });
        var go = el('button.btn.btn--indigo.btn--sm', { type: 'button' }, '填入');
        go.addEventListener('click', function () { fillFromInput(input); });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); fillFromInput(input); }
        });
        dom.extra.className = 'romaji-input';
        dom.extra.appendChild(el('label', { text: '或直接打字：' }));
        dom.extra.appendChild(input);
        dom.extra.appendChild(go);
      }

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
      if (!effects.isActive() || state.completed || state.status === 'correct') return;
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
      if (!effects.isActive() || state.completed || state.status === 'correct') return;
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
      node.className = 'slot is-filled';

      var next = firstEmpty();
      if (next >= 0) setActive(next);
      else setActive(-1);
      syncUI();
    }

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
        var available = tokenAvailable(+btn.dataset.tk);
        btn.classList.toggle('is-used', !available);
        btn.disabled = !available || state.status === 'correct' || state.completed;
      });
    }

    function firstEmpty() {
      for (var i = 0; i < state.item.slots.length; i++) {
        if (!state.item.slots[i].given && !state.item.slots[i].value) return i;
      }
      return -1;
    }

    function fillFromInput(input) {
      if (!effects.isActive() || state.completed || state.status === 'correct') return;
      var val = input.value.trim().toLowerCase().replace(/[^a-z]/g, '');
      if (!val) { U.toast('請輸入羅馬字', 'warn'); return; }

      var i = state.activeSlot;
      if (i < 0 || state.item.slots[i].given) i = firstEmpty();
      if (i < 0) { U.toast('空格都填滿囉，按「檢查答案」✓', 'warn'); return; }

      state.item.slots[i].value = val;
      var node = slotEl(i);
      node.textContent = val;
      node.className = 'slot is-filled';
      var next = firstEmpty();
      setActive(next);
      input.value = '';
      syncUI();
    }

    /* ======================================================== 檢核 */
    function onCheckClick() {
      if (!effects.isActive() || state.completed) return;
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
        node.classList.remove('is-correct', 'is-wrong');
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

      dom.checkBtn.textContent = state.index >= state.queue.length - 1 ? '🏁 看看成績' : '下一題 →';
      dom.checkBtn.className = 'btn btn--indigo';
      dom.hintBtn.disabled = true;
      syncUI();
      updateHud();

      // 答對 → 自動播放一次本句（日文＋中文），接著一句日語鼓勵
      if (speakTimer) clearTimeout(speakTimer);
      var answered = { kana: state.item.q.kana, zh: state.item.q.zh };
      speakTimer = effects.later(function () {
        speakTimer = null;
        if (!state.item || state.item.q.kana !== answered.kana) return;  // 已換題就不播
        speakResult();
      }, 380);
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
      if (!effects.isActive() || state.completed || state.status === 'correct') return;
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
        node.classList.remove('is-revealed');
      }, 1000);

      state.hints += 1;
      state.lastWasDirty = true;
      state.status = 'input';
      dom.checkBtn.textContent = '✓ 檢查答案';
      dom.checkBtn.className = 'btn btn--matcha';
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
      dom.hud.mode.textContent = state.mode === 'A' ? '填平假名' : '填羅馬字';
      dom.progressBar.style.width = (state.index / state.queue.length * 100) + '%';
    }

    function gameComplete() {
      if (!effects.isActive() || state.completed) return;
      state.completed = true;
      effects.reset();
      speakTimer = null;
      U.Speech.stop();
      dom.checkBtn.disabled = true;
      dom.hintBtn.disabled = true;
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
      if (!effects.isActive() || restartPending) return;
      restartPending = true;
      U.confirmModal({
        emoji: '↺',
        title: '要換一批題目嗎？',
        body: '會重新從題庫抽題並打亂順序，目前分數將歸零。',
        okLabel: '重新抽題'
      }).then(function (ok) {
        restartPending = false;
        if (ok && effects.isActive()) startGame();
      });
    }

    /* ======================================================== 啟動 */
    buildShell();
    startGame();

    return {
      destroy: function () {
        effects.destroy();
        state.completed = true;
        if (state.ticker) state.ticker.stop();
        speakTimer = null;
        U.Speech.stop();
      }
    };
  }

  global.App = global.App || {};
  global.App.sentence = { mount: mount };
})(window);
