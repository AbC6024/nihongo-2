/* =========================================================
   遊戲 4：助詞配對
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  let timer = null, st = null;

  const ROUND_TIME = 75;
  const ROMAJI = {};
  JPQ.PARTICLES.forEach(p => ROMAJI[p.k] = p.ro);

  function intro(stage) {
    stop();
    st = null;
    const best = JPQ.store.record('match');
    stage.innerHTML = `<div class="panel narrow center">
      <h2>助詞配對</h2>
      <p class="section-note" style="margin-top:10px">
        左邊點一個助詞，右邊點它的用法說明，配對成功就會鎖定。<br>
        三個回合共 24 組：功能 → 讀句子 → 易混淆比較。
      </p>
      ${best ? `<div class="result-score" style="margin-top:18px">${best}</div><p>最好成績（分數）</p>` : ''}
      <div class="btn-row">
        <button class="btn" id="startBtn">開始配對</button>
        <button class="btn grey" id="backBtn">回主頁</button>
      </div>
    </div>`;
    JPQ.hud.set('助詞配對', '三回合 24 組');
    JPQ.hud.progress(0);
    JPQ.hud.pills([]);
    U.$('#startBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); begin(stage); });
    U.$('#backBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); JPQ.go('#/'); });
  }

  function begin(stage) {
    st = { r: 0, mistakes: 0, score: 0, time: ROUND_TIME, sel: null, done: 0 };
    round(stage);
  }

  function round(stage) {
    const data = JPQ.MATCH[st.r];
    st.sel = null;
    st.time = ROUND_TIME;
    st.roundWrong = 0;
    const left = U.shuffle(data.pairs);
    const right = U.shuffle(data.pairs);

    stage.innerHTML = `<div class="panel">
      <div class="match-wrap">
        ${left.map((p, i) => `<button class="mtile" data-side="L" data-k="${p.k}" style="grid-row:${i + 1}">
            <span class="pmark">${p.k}</span>
            <span class="ptext">${ROMAJI[p.k] || ''}</span>
          </button>`).join('')}
        <span class="mid-label" style="grid-row:1">配對 →</span>
        ${right.map((p, i) => `<button class="mtile" data-side="R" data-k="${p.k}" style="grid-row:${i + 1}">
            <span class="ptext">${U.ruby(p.t)}</span>
          </button>`).join('')}
      </div>
    </div>`;

    U.$$('.mtile', stage).forEach(b => b.addEventListener('click', () => pick(stage, b)));
    JPQ.hud.set(data.title, `第 ${st.r + 1} / ${JPQ.MATCH.length} 回合`);
    paint(stage);

    stop();
    timer = setInterval(() => {
      st.time--;
      paint(stage);
      if (st.time <= 5 && st.time > 0) JPQ.sfx.tick();
      if (st.time <= 0) { stop(); endRound(stage, true); }
    }, 1000);
  }

  function pick(stage, btn) {
    if (btn.disabled) return;
    const side = btn.dataset.side, k = btn.dataset.k;

    if (!st.sel) {
      st.sel = { side: side, k: k, btn: btn };
      btn.classList.add('sel');
      JPQ.sfx.click();
      return;
    }
    if (st.sel.side === side) {           // 換選左邊
      st.sel.btn.classList.remove('sel');
      st.sel = { side: side, k: k, btn: btn };
      btn.classList.add('sel');
      return;
    }
    // 左右都選了 → 判定
    const prev = st.sel.btn;
    prev.classList.remove('sel');
    st.sel = null;

    if (prev.dataset.k === k) {
      prev.classList.add('hit');
      btn.classList.add('hit');
      prev.disabled = btn.disabled = true;
      st.done++;
      st.score += 10;
      JPQ.sfx.match();
      paint(stage);
      if (st.done % 4 === 0) JPQ.fx.burst(window.innerWidth / 2, 240, 50);
      if (st.done % 8 === 0) endRound(stage, false);
    } else {
      st.mistakes++;
      st.roundWrong++;
      st.score = Math.max(0, st.score - 3);
      prev.classList.add('miss');
      btn.classList.add('miss');
      JPQ.sfx.wrong();
      paint(stage);
      setTimeout(() => prev.classList.remove('miss'), 480);
      setTimeout(() => btn.classList.remove('miss'), 480);
    }
  }

  function paint(stage) {
    const total = JPQ.MATCH.length * 8;
    JPQ.hud.progress(st.done / total);
    JPQ.hud.pills([
      { label: '配對', value: st.done + '/' + total },
      { label: '分數', value: st.score },
      { label: '時間', value: st.time + 's', cls: st.time <= 10 ? 'time danger' : 'time' }
    ]);
  }

  function endRound(stage, timeout) {
    stop();
    const last = st.r >= JPQ.MATCH.length - 1;
    const next = () => { JPQ.modal.close(); if (last) finish(stage); else { st.r++; round(stage); } };
    if (last) return next();

    JPQ.modal.show({
      title: '第 ' + (st.r + 1) + ' 回合完成',
      html: timeout
        ? '<p>時間到了！沒配到的題目就當複習題。</p>'
        : '<p>八組都配對成功，繼續下一回合！</p>',
      actions: [{ label: '下一回合 →', onClick: next }]
    });
  }

  function finish(stage) {
    JPQ.store.setRecord('match', st.score);
    const stars = st.mistakes === 0 ? 3 : (st.mistakes <= 3 ? 2 : 1);
    JPQ.hud.progress(1);
    JPQ.hud.pills([{ label: '分數', value: st.score }]);
    JPQ.sfx.levelup();
    JPQ.fx.center();
    JPQ.modal.show({
      title: '配對完成！',
      html: `<div class="result-stars">${U.stars(stars)}</div>
        <div class="result-score">${st.score}</div>
        <p>${stars === 3 ? '零失誤，厲害！🎉' : (stars === 2 ? '只錯幾題，再來一次更好' : '把速查表再看一遍就會更順')}</p>
        <div class="result-row">
          <div>配對成功<b>${st.done}</b></div>
          <div>配錯<b>${st.mistakes}</b></div>
          <div>最高分<b>${JPQ.store.record('match')}</b></div>
        </div>`,
      actions: [
        { label: '再玩一次', onClick: () => { JPQ.modal.close(); begin(stage); } },
        { label: '回主頁', cls: 'grey', onClick: () => { JPQ.modal.close(); JPQ.go('#/'); } }
      ]
    });
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  JPQ.registerGame({
    name: 'match',
    title: '助詞配對',
    sub: '把助詞和它的用法配起來',
    card: {
      thumb: 'link',
      icon: '🔗',
      color: '#8ec5f5',
      title: '助詞配對',
      desc: '一邊是助詞、一邊是說明或句子空格，配對成功就鎖住。三回合從功能記到易混淆比較。',
      tag: '24 組'
    },
    best: () => {
      const b = JPQ.store.record('match');
      return b ? `最高分 <b>${b}</b>` : '';
    },
    mount(stage) { intro(stage); },
    unmount: stop
  });

})(window);
