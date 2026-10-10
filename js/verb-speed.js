/* =========================================================
   動詞活用 — 遊戲 2：快速搶答
   ------------------------------------------------------------
   題庫由引擎一次生出幾百題，全部活用形混在一起抽，
   所以不會只有熟悉的那幾個關卡。
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  let unkey = null, timer = null, playing = false;

  const TIME = 45;
  const RECORD = 'verb-speed';

  function intro(stage) {
    stop();
    const best = JPQ.store.record(RECORD);
    stage.innerHTML = `<div class="panel narrow center">
      <h2>快速搶答</h2>
      <p class="section-note" style="margin-top:10px">
        45 秒內盡量答對更多題目。<br>
        答對 +10 分，連擊每多一題再 +2 分（最高 +10）。<br>
        答錯扣 3 秒，連擊歸零。
      </p>
      <p style="font-size:13px;color:#8b91ad;margin-top:8px">
        小提示：可以直接按鍵盤 1 2 3 4 選答案<br>
        這一關的題目是全部活用形混抽，包含可能・受身・使役
      </p>
      ${best ? `<div class="result-score" style="margin-top:18px">${best}</div><p>目前最高分</p>` : ''}
      <div class="btn-row">
        <button class="btn" id="startBtn">開始搶答</button>
        <button class="btn grey" id="backBtn">回主頁</button>
      </div>
    </div>`;
    JPQ.hud.set('快速搶答', '45 秒挑戰');
    JPQ.hud.progress(0);
    JPQ.hud.pills([]);
    U.$('#startBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); begin(stage); });
    U.$('#backBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); JPQ.go('#/'); });
  }

  function begin(stage) {
    const qs = JPQ.verbGame.poolAll();
    if (!qs.length) {
      JPQ.modal.show({
        title: '題庫是空的',
        html: '<p>動詞資料載入失敗，請重新整理頁面。</p>',
        actions: [{ label: '重新整理', onClick: () => location.reload() }]
      });
      return;
    }

    const st = { i: 0, score: 0, combo: 0, best: 0, right: 0, left: TIME, cur: null };

    stage.innerHTML = `<div class="panel">
      <div class="q-sentence">
        <span class="vb-word" id="vbw"></span>
        <span class="vb-arrow">→</span>
        <span class="vb-form" id="vbf"></span>
      </div>
      <div class="q-zh" id="vbh"></div>
      <div class="opt-grid" id="opts"></div>
    </div>`;

    function draw() {
      const q = qs[Math.floor(Math.random() * qs.length)];
      st.cur = q;
      const opts = U.shuffle(q.opts.concat([q.a]));
      const form = JPQ.verb.form(q.key);

      U.$('#vbw', stage).innerHTML = U.ruby(q.from);
      U.$('#vbf', stage).innerHTML = form.label + `<em>${form.en}</em>`;
      U.$('#vbh', stage).textContent = form.hint;
      U.$('#opts', stage).innerHTML = opts.map((o, i) =>
        `<button class="opt" data-o="${o}"><span class="key">${i + 1}</span>${o}</button>`).join('');
      U.$$('#opts .opt', stage).forEach(b =>
        b.addEventListener('click', () => hit(b)));
      paint();
    }

    function paint() {
      JPQ.hud.pills([
        { label: '分數', value: st.score },
        { label: '連擊', value: 'x' + st.combo, cls: st.combo >= 3 ? 'combo' : '' },
        { label: '時間', value: st.left + 's', cls: st.left <= 10 ? 'time danger' : 'time' }
      ]);
      JPQ.hud.progress(st.left / TIME);
    }

    function hit(btn) {
      if (!playing) return;
      U.$$('#opts .opt', stage).forEach(b => b.disabled = true);
      const ok = btn.dataset.o === st.cur.a;

      if (ok) {
        st.right++;
        st.combo++;
        st.best = Math.max(st.best, st.combo);
        st.score += 10 + Math.min(st.combo - 1, 5) * 2;
        btn.classList.add('correct');
        JPQ.sfx.correct();
        if (st.combo > 0 && st.combo % 5 === 0) JPQ.sfx.levelup();
      } else {
        st.combo = 0;
        st.left = Math.max(0, st.left - 3);
        btn.classList.add('wrong');
        U.$$('#opts .opt', stage).forEach(b => {
          if (b.dataset.o === st.cur.a) b.classList.add('correct');
        });
        JPQ.sfx.wrong();
      }

      JPQ.stats.answer('形:' + st.cur.key, ok);
      paint();
      st.i++;
      setTimeout(() => {
        if (!playing) return;
        if (st.left <= 0) end(); else draw();
      }, ok ? 190 : 520);
    }

    function end() {
      stop();
      JPQ.store.setRecord(RECORD, st.score);
      const wrong = st.i - st.right;
      JPQ.stats.run('verb-speed', st.right + wrong, st.right);
      JPQ.hud.pills([{ label: '分數', value: st.score }]);
      JPQ.sfx.levelup();
      JPQ.fx.center();
      const acc = (st.right + wrong) ? Math.round(st.right / (st.right + wrong) * 100) : 0;
      JPQ.modal.show({
        title: '時間到！',
        html: `<div class="result-score">${st.score}</div>
          <p>最高連擊 <b>${st.best}</b> 連</p>
          <div class="result-row">
            <div>答對<b>${st.right}</b></div>
            <div>答錯<b>${wrong}</b></div>
            <div>正確率<b>${acc}%</b></div>
            <div>最高分<b>${JPQ.store.record(RECORD)}</b></div>
          </div>`,
        actions: [
          { label: '🏆 登記排行榜', cls: 'gold', onClick: () => {
              JPQ.modal.close();
              JPQ.lb.offer('verb-speed', st.score, '答對 ' + st.right + ' 題 · 最高 ' + st.best + ' 連');
            } },
          { label: '再玩一次', onClick: () => { JPQ.modal.close(); begin(stage); } },
          { label: '回主頁', cls: 'grey', onClick: () => { JPQ.modal.close(); JPQ.go('#/'); } }
        ]
      });
    }

    playing = true;
    st.left = TIME;
    draw();

    unkey = JPQ.onKey(e => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) {
        const b = U.$$('#opts .opt', stage)[n - 1];
        if (b && !b.disabled) hit(b);
      }
    });

    timer = setInterval(() => {
      st.left--;
      if (st.left <= 0) { st.left = 0; paint(); end(); return; }
      if (st.left <= 5) JPQ.sfx.tick();
      paint();
    }, 1000);
  }

  function stop() {
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (unkey) { unkey(); unkey = null; }
    if (global.speechSynthesis) JPQ.speech.stop();
  }

  JPQ.registerGame({
    name: 'verb-speed',
    title: '快速搶答',
    sub: '45 秒衝高分',
    card: {
      thumb: 'speed',
      icon: '⚡',
      color: '#f7a8c4',
      title: '快速搶答',
      desc: '45 秒限時，全部活用形混在一起抽，適合把整張活用表練熟。連擊會越疊越高。',
      tag: '限時 45 秒'
    },
    best: () => {
      const b = JPQ.store.record(RECORD);
      return b ? `最高分 <b>${b}</b>` : '';
    },
    mount(stage) { intro(stage); },
    unmount: stop
  });

})(window);
