/* =========================================================
   遊戲 3：句子重排
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  let unkey = null;
  let st = null;

  function items() { return JPQ.SCRAMBLE; }

  /* ---------- 說明 ---------- */
  function intro(stage) {
    st = null;
    const best = JPQ.store.record('scramble');
    stage.innerHTML = `<div class="panel narrow center">
      <h2>句子重排</h2>
      <p class="section-note" style="margin-top:10px">
        看中文，把打亂的單字照正確順序點出來，組成完整的日語句子。<br>
        連續答對會有連擊加分；卡住時可以按「提示」。
      </p>
      <p style="font-size:13px;color:#8b91ad;margin-top:8px">共 ${items().length} 句</p>
      ${best ? `<div class="result-score" style="margin-top:18px">${best}</div><p>最好成績（答對句數）</p>` : ''}
      <div class="btn-row">
        <button class="btn" id="startBtn">開始挑戰</button>
        <button class="btn grey" id="backBtn">回主頁</button>
      </div>
    </div>`;
    JPQ.hud.set('句子重排', '看中文組句子');
    JPQ.hud.progress(0);
    JPQ.hud.pills([]);
    U.$('#startBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); begin(stage); });
    U.$('#backBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); JPQ.go('#/'); });
  }

  /* ---------- 對戰 ---------- */
  function begin(stage) {
    st = { list: items(), i: 0, right: 0, combo: 0, best: 0, cur: null, placed: [], pool: [] };
    draw(stage);
  }

function draw(stage) {
    if (st.i >= st.list.length) return finish(stage);
    st.cur = st.list[st.i];
    st.placed = [];
    st.hintUsed = false;
    st.pool = U.shuffle(st.cur.ans.map((t, i) => ({ t: t, i: i })));

    stage.innerHTML = `<div class="panel">
      <div class="scr-prompt">
        <div class="zh">${st.cur.zh}</div>
        <div class="jp-read">把下面 ${st.cur.ans.length} 個單字排成正確的日語句子　·　想重來可以點掉已排的單字</div>
      </div>
      <div class="scr-answer" id="slot"></div>
      <div class="scr-pool" id="pool"></div>
      <div class="scr-tools">
        <button class="btn ghost" id="hintBtn">💡 提示（每題一次）</button>
        <button class="btn" id="checkBtn">檢查答案</button>
      </div>
    </div>`;

    paintTokens(stage);
    paint(stage);
    if (unkey) { unkey(); unkey = null; }
    unkey = JPQ.onKey(e => {
      if (e.key === 'Enter') check(stage);
      if (e.key === 'Backspace' || e.key === 'Delete') { pop(stage); }
    });

U.$('#checkBtn', stage).addEventListener('click', () => check(stage));
    U.$('#hintBtn', stage).addEventListener('click', () => hint(stage));
  }

function paintTokens(stage) {
    U.$('#slot', stage).innerHTML = st.placed.length
      ? st.placed.map((p, idx) =>
          `<button class="tok" data-pool="${p.i}" data-slot="${idx}" data-t="${U.strip(p.t)}">${U.ruby(p.t)}</button>`).join('')
      : '<span style="color:#a8adC4;font-size:14px">點下面的單字開始排</span>';
    U.$('#pool', stage).innerHTML = st.pool.map(p =>
      `<button class="tok plain" data-pool="${p.i}" data-t="${U.strip(p.t)}">${U.ruby(p.t)}</button>`).join('');

    U.$$('[data-pool]', stage).forEach(b => b.addEventListener('click', () => {
      const idx = Number(b.dataset.pool);
      if (b.dataset.slot !== undefined) {           // 從答案列移回選字池
        const item = st.placed.splice(Number(b.dataset.slot), 1)[0];
        if (item) st.pool.push(item);                // 整包放回去，文字不會遺失
        JPQ.sfx.click();
      } else {                                        // 從選字池放進答案
        const at = st.pool.findIndex(x => x.i === idx);
        if (at < 0) return;
        st.placed.push(st.pool.splice(at, 1)[0]);
        JPQ.sfx.click();
      }
      paintTokens(stage);
    }));

    U.$('#checkBtn', stage).disabled = st.placed.length !== st.cur.ans.length;
  }

  /* 提示：每一題只能用一次，避免一直按就把整句送完 */
  function hint(stage) {
    if (st.hintUsed) return;
    const i = st.cur.ans.findIndex((t, k) =>
      !st.placed.some(p => p.i === k) && st.pool.some(x => x.i === k));
    if (i < 0) return;
    const at = st.pool.findIndex(x => x.i === i);
    if (at < 0) return;
    st.placed.push(st.pool.splice(at, 1)[0]);
    st.hintUsed = true;
    JPQ.sfx.match();
    paintTokens(stage);
    const btn = U.$('#hintBtn', stage);
    btn.disabled = true;
    btn.textContent = '已用過提示';
  }

  function pop(stage) {
    if (!st.placed.length) return;
    st.pool.push(st.placed.pop());
    paintTokens(stage);
  }

function check(stage) {
    if (st.placed.length !== st.cur.ans.length) return;
    const mine = st.placed.map(p => U.strip(p.t));
    const slot = U.$('#slot', stage);
    const ok = mine.join('|') === st.cur.ans.map(U.strip).join('|');

    if (ok) {
      st.right++; st.combo++; st.best = Math.max(st.best, st.combo);
      slot.classList.add('good');
      JPQ.sfx.correct();
      if (st.combo % 5 === 0) { JPQ.sfx.levelup(); JPQ.fx.burst(window.innerWidth / 2, 200, 60); }
      U.$$('.scr-tools .btn', stage).forEach(b => b.disabled = true);
      slot.insertAdjacentHTML('afterend', `
        <div class="fb ok show" style="text-align:center">
          <strong>正確！${U.stars(st.combo >= 3 ? 3 : 1)}</strong>
          <p>${st.cur.note || ''}</p>
        </div>
        <div class="btn-row"><button class="btn" id="nextBtn">${st.i + 1 >= st.list.length ? '看成績 →' : '下一句 →'}</button></div>`);
      U.$('#nextBtn', stage).addEventListener('click', () => { st.i++; draw(stage); });
      paint(stage);
} else {
      st.combo = 0; st.wrong = (st.wrong || 0) + 1;
      slot.classList.add('shake');
      setTimeout(() => slot.classList.remove('shake'), 320);
      JPQ.sfx.wrong();
      /* 答錯就直接把正確寫法給你看，不再偷偷幫你填一個（那會吃掉提示） */
      const answerHTML = st.cur.ans.map(t => U.ruby(t)).join('');
      slot.insertAdjacentHTML('afterend', `
        <div class="fb no show" style="text-align:center">
          <strong>順序還不太對，正確的寫法是：</strong>
          <p style="font-size:19px;margin:6px 0 2px">${answerHTML}</p>
          <p>${st.cur.note || ''}</p>
        </div>`);
    }
  }

  function paint(stage) {
    JPQ.hud.set('句子重排', (st.i + 1) + ' / ' + st.list.length);
    JPQ.hud.progress(st.i / st.list.length);
    JPQ.hud.pills([
      { label: '答對', value: st.right },
      { label: '連擊', value: 'x' + st.combo, cls: st.combo >= 3 ? 'combo' : '' }
    ]);
  }

  function finish(stage) {
    JPQ.store.setRecord('scramble', st.right);
    JPQ.hud.progress(1);
    JPQ.hud.pills([{ label: '答對', value: st.right }]);
    JPQ.sfx.levelup();
    JPQ.fx.center();
    JPQ.modal.show({
      title: '全部完成！',
      html: `<div class="result-score">${st.right} / ${st.list.length}</div>
        <p>答對 ${st.right} 句${st.wrong ? '，過程中答錯 ' + st.wrong + ' 次' : ''}</p>
        <div class="result-row">
          <div>最高連擊<b>${st.best}</b></div>
          <div>最佳成績<b>${JPQ.store.record('scramble')}</b></div>
        </div>
        <p style="margin-top:14px;font-size:14px">${wrongOnes(st)}</p>`,
actions: [
        { label: '🏆 登記排行榜', cls: 'gold', onClick: () => {
            JPQ.modal.close();
            JPQ.lb.offer('scramble', st.right, '最高 ' + st.best + ' 連');
          } },
        { label: '再玩一次', onClick: () => { JPQ.modal.close(); begin(stage); } },
        { label: '回主頁', cls: 'grey', onClick: () => { JPQ.modal.close(); JPQ.go('#/'); } }
      ]
    });
  }

  function wrongOnes(state) {
    return state.wrong
      ? '答錯時有送出提示，再看一次速查表會更順手。'
      : '全部一次答對，太強了！🎉';
  }

  JPQ.registerGame({
    name: 'scramble',
    title: '句子重排',
    sub: '看中文，把日語句子排出來',
    card: {
      thumb: 'tiles',
      icon: '🧩',
      color: '#7fd8c4',
      title: '句子重排',
      desc: '中文提示配上打亂的單字，點一點把日語句子排回正確順序，練語感與助詞位置。',
      tag: items().length + ' 句'
    },
    best: () => {
      const b = JPQ.store.record('scramble');
      return b ? `最佳 <b>${b}</b>/${items().length}` : '';
    },
    mount(stage) { if (unkey) { unkey(); unkey = null; } intro(stage); },
    unmount() { if (unkey) { unkey(); unkey = null; } st = null; }
  });

})(window);
