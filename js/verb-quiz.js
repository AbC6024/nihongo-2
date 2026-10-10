/* =========================================================
   動詞活用 — 遊戲 1：選擇題闖關
   ------------------------------------------------------------
   題目是引擎算出來的：顯示一個動詞 + 一個活用形，
   從四個形狀很像的選項裡挑出正確答案。
   答錯時不是只秀答案，而是把「為什麼是這個」拆開講。
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  let unkey = null;
  let state = null;

  /* 動詞遊戲的星星存檔要跟助詞遊戲分開，否則 LEVEL 1 會互相覆蓋 */
  const sKey = no => 'verb' + no;
  const levelStars = no => JPQ.store.levelStars(sKey(no));
  const setLevelStars = (no, s) => JPQ.store.setLevelStars(sKey(no), s);
  function totalStars() {
    return JPQ.VERB_LEVELS.reduce((sum, l) => sum + levelStars(l.no), 0);
  }

  /* ---------- 關卡選擇 ---------- */
  function showLevels(stage) {
    state = null;
    const maxStars = JPQ.VERB_LEVELS.length * 3;

    const cards = JPQ.VERB_LEVELS.map(l => {
      const stars = levelStars(l.no);
      const locked = l.no > 1 && levelStars(l.no - 1) === 0;
      return `<button class="level-btn" data-lv="${l.no}" ${locked ? 'disabled' : ''}>
        ${locked ? '<span class="lv-lock">🔒</span>' : ''}
        <span class="lv-no">LEVEL ${U.pad(l.no)}</span>
        <strong>${l.title}</strong>
        <small>${l.sub}<br>${l.count} 題</small>
        <span class="stars">${U.stars(stars)}</span>
      </button>`;
    }).join('');

    stage.innerHTML = `<div class="panel narrow">
      <h2 class="center">選擇關卡</h2>
      <p class="center section-note">每一關練一組活用形，全對可以拿三顆星 ⭐</p>
      <div class="level-grid">${cards}</div>
      <div class="btn-row">
        <button class="btn grey" data-go="#/">回主頁</button>
      </div>
    </div>`;

    JPQ.hud.set('選擇題闖關', '已完成 ' + totalStars() + ' / ' + maxStars + ' ⭐');
    JPQ.hud.progress(0);
    JPQ.hud.clearPills();

    U.$$('.level-btn', stage).forEach(btn => btn.addEventListener('click', () => {
      if (btn.disabled) return;
      JPQ.sfx.click();
      startLevel(Number(btn.dataset.lv), stage);
    }));
    U.$('[data-go="#/"]', stage).addEventListener('click', () => JPQ.sfx.click());
  }

  /* ---------- 開始一關 ---------- */
  function startLevel(no, stage) {
    const lv = JPQ.VERB_LEVELS.find(l => l.no === no);
    const qs = JPQ.verbGame.build(lv);
    if (!qs.length) {
      JPQ.modal.show({
        title: '這一關出題失敗',
        html: '<p>這個組合目前生不出題目，請選別的關卡。</p>',
        actions: [
          { label: '選別的關卡', onClick: () => { JPQ.modal.close(); showLevels(stage); } },
          { label: '回主頁', cls: 'grey', onClick: () => { JPQ.modal.close(); JPQ.go('#/'); } }
        ]
      });
      return;
    }
    state = { no: no, i: 0, wrong: 0, qs: qs };
    renderQuestion(stage, lv);
  }

  /* ---------- 出題 ---------- */
  function renderQuestion(stage, lv) {
    if (unkey) { unkey(); unkey = null; }
    const q = state.qs[state.i];
    state.q = q;

    const form = JPQ.verb.form(q.key);
    const opts = U.shuffle(q.opts.concat([q.a]));

    stage.innerHTML = `<div class="panel">
      <div class="q-sentence">
        <span class="vb-word">${U.ruby(q.from)}</span>
        <span class="vb-arrow">→</span>
        <span class="vb-form">${form.label}<em>${form.en}</em></span>
      </div>
      <div class="q-zh">${form.hint}</div>
      <div class="opt-grid">
        ${opts.map((o, i) => `<button class="opt" data-o="${o}">
          <span class="key">${i + 1}</span>${o}</button>`).join('')}
      </div>
      <div class="fb" id="fb"></div>
      <div class="btn-row" id="nextRow" style="display:none">
        <button class="btn" id="nextBtn">下一題 →</button>
      </div>
    </div>`;

    JPQ.hud.set('第 ' + lv.no + ' 關 · ' + lv.title, lv.sub);
    JPQ.hud.progress(state.i / state.qs.length);
    paint();

    U.$$('.opt', stage).forEach(btn => btn.addEventListener('click', () => answer(btn, stage, lv)));

    const nextBtn = U.$('#nextBtn', stage);
    nextBtn.addEventListener('click', () => { JPQ.sfx.click(); next(stage, lv); });

    unkey = JPQ.onKey(e => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= opts.length) {
        const btn = U.$$('.opt', stage)[n - 1];
        if (btn && !btn.disabled) answer(btn, stage, lv);
      } else if (e.key === 'Enter') {
        next(stage, lv);
      }
    });
  }

  function paint() {
    JPQ.hud.pills([
      { label: '進度', value: (state.i + 1) + '/' + state.qs.length },
      { label: '答錯', value: state.wrong }
    ]);
  }

  /* ---------- 判定 ---------- */
  function answer(btn, stage, lv) {
    U.$$('.opt', stage).forEach(b => b.disabled = true);
    const pick = btn.dataset.o;
    const ok = pick === state.q.a;

    U.$$('.opt', stage).forEach(b => {
      if (b.dataset.o === state.q.a) b.classList.add('correct');
      else if (b === btn) b.classList.add('wrong');
      else b.classList.add('dim');
    });

    if (ok) JPQ.sfx.correct();
    else { state.wrong++; JPQ.sfx.wrong(); }

    /* 記錄這題的表現：用活用形當統計單位 */
    JPQ.stats.answer('形:' + state.q.key, ok);

    const fb = U.$('#fb', stage);
    fb.className = 'fb show ' + (ok ? 'ok' : 'no');
    fb.innerHTML = feedback(state.q, ok);

    U.$('#nextRow', stage).style.display = 'flex';
    U.$('#nextBtn', stage).focus();
    paint();
  }

  /* 把「為什麼是這個答案」拆成可以看懂的步驟 */
  function feedback(q, ok) {
    const form = JPQ.verb.form(q.key);
    const ex = JPQ.verbGame.explain(q);
    const parts = ex.parts && ex.parts.length
      ? `<div class="vb-chain">${ex.parts.map(p =>
          `<span class="vb-step"><em>${p.label}</em><b>${p.kana}</b></span>`).join('<i>→</i>')}</div>`
      : '';
    const note = (ex.note || q.verb.note)
      ? `<p class="vb-note">${ex.note || q.verb.note}</p>`
      : '';
    return `<strong>${ok ? '答對了！' : '正確答案是「' + q.a + '」'}</strong>
      <p class="vb-answer">${U.ruby(q.from)} → ${q.a}（${form.label}）</p>
      ${parts}${note}
      <p class="vb-tip">${form.hint}</p>`;
  }

  function next(stage, lv) {
    state.i++;
    if (state.i >= state.qs.length) finish(stage, lv);
    else renderQuestion(stage, lv);
  }

  /* ---------- 結算 ---------- */
  function finish(stage, lv) {
    const stars = state.wrong === 0 ? 3 : (state.wrong <= 2 ? 2 : 1);
    setLevelStars(lv.no, stars);
    JPQ.stats.run('verb-quiz', state.qs.length, state.qs.length - state.wrong);
    if (unkey) { unkey(); unkey = null; }

    const row = U.$('#nextRow', stage);
    if (row) row.style.display = 'none';
    JPQ.hud.progress(1);
    JPQ.hud.pills([{ label: '星星', value: '⭐'.repeat(stars) }]);
    if (stars === 3) { JPQ.sfx.levelup(); JPQ.fx.center(); }

    const isLast = lv.no >= JPQ.VERB_LEVELS.length;
    JPQ.modal.show({
      title: '第 ' + lv.no + ' 關完成！',
      html: `
        <div class="result-stars">${U.stars(stars)}</div>
        <div class="result-score">${state.qs.length - state.wrong}/${state.qs.length}</div>
        <p>${stars === 3 ? '全對！規則已經很熟了 🎉' : (stars === 2 ? '不錯，再練一次就能拿三顆星' : '回速查表看一下每一步怎麼變，再挑戰一次')}</p>
        <div class="result-row">
          <div>答對題數<b>${state.qs.length - state.wrong}</b></div>
          <div>答錯題數<b>${state.wrong}</b></div>
          <div>本關星星<b>${stars} / 3</b></div>
          <div>總星星<b>${totalStars()}</b></div>
        </div>`,
      actions: [
        { label: '🏆 登記排行榜', cls: 'gold', onClick: () => {
            JPQ.modal.close();
            JPQ.lb.offer('verb-quiz', totalStars(), '第 ' + lv.no + ' 關 · 共 ' + totalStars() + ' 星星');
          } },
        !isLast ? { label: '下一關 →', onClick: () => {
            JPQ.modal.close(); state = null; showLevels(stage);
          } } : null,
        { label: '重玩本關', cls: 'ghost', onClick: () => {
            JPQ.modal.close(); startLevel(lv.no, stage);
          } },
        { label: '回主頁', cls: 'grey', onClick: () => { JPQ.modal.close(); JPQ.go('#/'); } }
      ].filter(Boolean)
    });
  }

  /* ---------- 註冊 ---------- */
  JPQ.registerGame({
    name: 'verb-quiz',
    title: '選擇題闖關',
    sub: '八關從一段練到可能受身使役',
    card: {
      thumb: 'quiz',
      icon: '🎯',
      color: '#93a4f0',
      title: '選擇題闖關',
      desc: '看動詞挑活用形，答錯會把變化過程一步步拆開講。八關從一段動詞一路練到可能・受身・使役。',
      tag: '8 關'
    },
    best: () => {
      const s = totalStars();
      return s ? `${s} ⭐` : '';
    },
    mount(stage) {
      if (unkey) { unkey(); unkey = null; }
      showLevels(stage);
    },
    unmount() { if (unkey) { unkey(); unkey = null; } }
  });

})(window);
