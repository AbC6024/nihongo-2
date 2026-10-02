/* =========================================================
   遊戲 1：選擇題闖關
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  let unkey = null;
  let state = null;

  /* ---------- 關卡選擇 ---------- */
  function showLevels(stage) {
    state = null;
    const total = JPQ.LEVELS.length;
    const maxNo = JPQ.LEVELS.reduce((m, l) =>
      JPQ.store.levelStars(l.no) > 0 ? Math.max(m, l.no) : m, 1);

    const cards = JPQ.LEVELS.map(l => {
      const stars = JPQ.store.levelStars(l.no);
      const locked = l.no > 1 && JPQ.store.levelStars(l.no - 1) === 0;
      return `<button class="level-btn" data-lv="${l.no}" ${locked ? 'disabled' : ''}>
        ${locked ? '<span class="lv-lock">🔒</span>' : ''}
        <span class="lv-no">LEVEL ${U.pad(l.no)}</span>
        <strong>${l.title}</strong>
        <small>${l.sub}<br>${l.qs.length} 題</small>
        <span class="stars">${U.stars(stars)}</span>
      </button>`;
    }).join('');

    stage.innerHTML = `<div class="panel narrow">
      <h2 class="center">選擇關卡</h2>
      <p class="center section-note">每一關有 6～8 題，全對可以拿三顆星 ⭐</p>
      <div class="level-grid">${cards}</div>
      <div class="btn-row">
        <button class="btn grey" data-go="#/">回主頁</button>
      </div>
    </div>`;

    JPQ.hud.set('選擇題闖關', '已完成 ' + JPQ.store.totalStars() + ' / ' + (total * 3) + ' ⭐');
    JPQ.hud.progress(0);

    U.$$('.level-btn', stage).forEach(btn => btn.addEventListener('click', () => {
      if (btn.disabled) return;
      JPQ.sfx.click();
      startLevel(Number(btn.dataset.lv), stage);
    }));
    U.$('[data-go="#/"]', stage).addEventListener('click', () => JPQ.sfx.click());
  }

  /* ---------- 開始一關 ---------- */
  function startLevel(no, stage) {
    const lv = JPQ.LEVELS.find(l => l.no === no);
    state = { no: no, i: 0, wrong: 0, q: null };
    renderQuestion(stage, lv);
  }

  /* ---------- 出題 ---------- */
  function renderQuestion(stage, lv) {
    if (unkey) { unkey(); unkey = null; }
    const q = lv.qs[state.i];
    state.q = q;
    const opts = U.shuffle(q.opts);

    stage.innerHTML = `<div class="panel">
      <div class="q-sentence">${U.blanked(q.q)}</div>
      <div class="q-zh">${q.zh}</div>
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
    JPQ.hud.progress(state.i / lv.qs.length);
    JPQ.hud.pills([
      { label: '進度', value: (state.i + 1) + '/' + lv.qs.length },
      { label: '答錯', value: state.wrong }
    ]);

    U.$$('.opt', stage).forEach(btn => {
      btn.addEventListener('click', () => answer(btn, stage, lv, q));
    });

    U.$('#nextBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); next(stage, lv); });

    unkey = JPQ.onKey(e => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= opts.length) {
        const btn = U.$$('.opt', stage)[n - 1];
        if (btn && !btn.disabled) answer(btn, stage, lv, q);
      } else if (e.key === 'Enter' && !U.$('#nextRow').style.display.includes('none')) {
        next(stage, lv);
      }
    });
  }

  /* ---------- 判定 ---------- */
  function answer(btn, stage, lv, q) {
    U.$$('.opt', stage).forEach(b => b.disabled = true);
    const pick = btn.dataset.o;
    const ok = pick === q.a;
    const fb = U.$('#fb', stage);

    U.$$('.opt', stage).forEach(b => {
      if (b.dataset.o === q.a) b.classList.add('correct');
      else if (b === btn) b.classList.add('wrong');
      else b.classList.add('dim');
    });

    if (ok) JPQ.sfx.correct();
    else { state.wrong++; JPQ.sfx.wrong(); }

    fb.className = 'fb show ' + (ok ? 'ok' : 'no');
    fb.innerHTML = `<strong>${ok ? '答對了！' : '正確答案是「' + q.a + '」'}</strong>
                    <p>${U.ruby(q.tip || '')}</p>`;

    U.$('#nextRow', stage).style.display = 'flex';
    U.$('#nextBtn', stage).focus();
    JPQ.hud.pills([
      { label: '進度', value: (state.i + 1) + '/' + lv.qs.length },
      { label: '答錯', value: state.wrong }
    ]);
  }

  function next(stage, lv) {
    state.i++;
    if (state.i >= lv.qs.length) finish(stage, lv);
    else renderQuestion(stage, lv);
  }

  /* ---------- 結算 ---------- */
  function finish(stage, lv) {
    const stars = state.wrong === 0 ? 3 : (state.wrong <= 2 ? 2 : 1);
    JPQ.store.setLevelStars(lv.no, stars);
    if (unkey) { unkey(); unkey = null; }
    const row = U.$('#nextRow', stage);
    if (row) row.style.display = 'none';
    JPQ.hud.progress(1);
    JPQ.hud.pills([{ label: '星星', value: '⭐'.repeat(stars) }]);
    if (stars === 3) { JPQ.sfx.levelup(); JPQ.fx.center(); }

    const isLast = lv.no >= JPQ.LEVELS.length;
    const html = `
      <div class="result-stars">${U.stars(stars)}</div>
      <div class="result-score">${lv.qs.length - state.wrong}/${lv.qs.length}</div>
      <p>${stars === 3 ? '全對！太厲害了 🎉' : (stars === 2 ? '不錯，再練一次就能拿三顆星' : '沒關係，回速查表看看再挑戰一次')}</p>
      <div class="result-row">
        <div>答對題數<b>${lv.qs.length - state.wrong}</b></div>
        <div>答錯題數<b>${state.wrong}</b></div>
        <div>本關星星<b>${stars} / 3</b></div>
      </div>`;

    JPQ.modal.show({
      title: '第 ' + lv.no + ' 關完成！',
      html: html,
      actions: [
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
    name: 'quiz',
    title: '選擇題闖關',
    sub: '每一關練一組助詞',
    card: {
      thumb: 'quiz',
      icon: '🎯',
      color: '#93a4f0',
      title: '選擇題闖關',
      desc: '句子里挖一個空格，選出正確的助詞。六關從 は／が 一路練到綜合題。',
      tag: '6 關'
    },
    best: () => {
      const s = JPQ.store.totalStars();
      return s ? `${JPQ.store.totalStars()} ⭐` : '';
    },
    mount(stage) {
      if (unkey) { unkey(); unkey = null; }
      showLevels(stage);
    },
    unmount() { if (unkey) { unkey(); unkey = null; } }
  });

})(window);
