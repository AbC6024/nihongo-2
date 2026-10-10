/* =========================================================
   動詞活用 — 遊戲 4：活用配對
   ------------------------------------------------------------
   左邊是活用形名稱，右邊是詞形，配對成功就鎖住。
   每個左側題目同時列出動詞與目標活用形，避免相同名稱無法辨別。
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  const verb = JPQ.verb;
  let timer = null, st = null;

  const ROUND_TIME = 80;
  const PAIRS_PER_ROUND = 8;

  /* 三回合，每回合 8 組 */
  const ROUNDS = [
    {
      title: '第 1 回合：基本形',
      sub: '辞書形 → て・た・ない',
      pairs: function () {
        return buildPairs(v => ['base', 'te', 'ta', 'nai']);
      }
    },
    {
      title: '第 2 回合：丁寧形',
      sub: '書きます／書きません／書きました',
      pairs: function () {
        return buildPairs(v => ['masu', 'masen', 'mashita', 'masendeshita']);
      }
    },
    {
      title: '第 3 回合：容易混的',
      sub: '意志形・推量・命令・条件・使役',
      pairs: function () {
        return buildPairs(v => ['you', 'darou', 'meirei', 'kate', 'saseru', 'dekita', 'ukerare']);
      }
    }
  ];

  /* 從動詞庫生出配對資料。pickKeys 決定這一回合用哪些活用形。 */
  function buildPairs(pickKeys) {
    const out = [];
    const verbs = U.shuffle(verb.VERBS);
    for (let i = 0; i < verbs.length && out.length < PAIRS_PER_ROUND * 3; i++) {
      const v = verbs[i];
      const keys = verb.formsFor(v).map(f => f.key).filter(k => pickKeys(v).includes(k));
      if (keys.length < 2) continue;
      const chosen = U.shuffle(keys).slice(0, 2);
      chosen.forEach(k => {
        out.push({
          k: k,
          label: verb.form(k).label,
          text: verb.display(v, k),
          zh: v.zh,
          base: verb.display(v, 'base')
        });
      });
    }
    return out;
  }

  /* 一回合取 8 組，盡量來自不同的動詞 */
  function takePairs(all) {
    const byVerb = {};
    all.forEach(p => {
      const key = p.text.replace(/\[.*?\]/g, '');
      byVerb[key] = byVerb[key] || [];
      byVerb[key].push(p);
    });
    const groups = U.shuffle(Object.keys(byVerb).map(k => byVerb[k]));
    const out = [];
    for (let i = 0; i < groups.length && out.length < PAIRS_PER_ROUND; i++) {
      const g = U.shuffle(groups[i]);
      out.push(g[0]);
    }
    return out;
  }

  function intro(stage) {
    stop();
    st = null;
    const best = JPQ.store.record('verb-match');
    stage.innerHTML = `<div class="panel narrow center">
      <h2>活用配對</h2>
      <p class="section-note" style="margin-top:10px">
        左邊點一個活用形，右邊點它的詞形，配對成功就會鎖住。<br>
        三個回合共 ${ROUNDS.length * PAIRS_PER_ROUND} 組，最後一回合專挑容易搞混的。
      </p>
      ${best ? `<div class="result-score" style="margin-top:18px">${best}</div><p>最好成績（分數）</p>` : ''}
      <div class="btn-row">
        <button class="btn" id="startBtn">開始配對</button>
        <button class="btn grey" id="backBtn">回主頁</button>
      </div>
    </div>`;
    JPQ.hud.set('活用配對', ROUNDS.length + ' 回合');
    JPQ.hud.progress(0);
    JPQ.hud.pills([]);
    U.$('#startBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); begin(stage); });
    U.$('#backBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); JPQ.go('#/'); });
  }

  function begin(stage) {
    st = { r: 0, mistakes: 0, score: 0, sel: null, done: 0, pools: null };
    round(stage);
  }

  function round(stage) {
    const R = ROUNDS[st.r];
    st.sel = null;
    st.time = ROUND_TIME;
    st.roundWrong = 0;
    st.roundDone = 0;

    const data = takePairs(R.pairs());
    if (!data.length) return finish(stage);

    const left = U.shuffle(data);
    const right = U.shuffle(data);

    stage.innerHTML = `<div class="panel">
      <p class="section-note center" style="margin-bottom:12px">${R.sub}</p>
      <div class="match-wrap">
        ${left.map((p, i) => `<button class="mtile" data-side="L" data-k="${p.k}" data-t="${p.text}" style="grid-row:${i + 1}">
            <span class="ptext">${U.ruby(p.base)}<br><b>${p.label}</b></span>
          </button>`).join('')}
        <span class="mid-label" style="grid-row:1">配對 →</span>
        ${right.map((p, i) => `<button class="mtile" data-side="R" data-k="${p.k}" data-t="${p.text}" style="grid-row:${i + 1}">
            <span class="ptext">${U.ruby(p.text)}</span>
          </button>`).join('')}
      </div>
      <div class="fb" id="fb"></div>
    </div>`;

    U.$$('.mtile', stage).forEach(b => b.addEventListener('click', () => pick(stage, b)));
    JPQ.hud.set('活用配對', R.title + ' · ' + R.sub);
    paint(stage);

    stop();
    timer = setInterval(() => {
      st.time--;
      paint(stage);
      if (st.time <= 5 && st.time > 0) JPQ.sfx.tick();
      if (st.time <= 0) { stop(); endRound(stage, true); }
    }, 1000);
  }

  /* 用「哪個動詞」當配對依據，不然同樣活用形會配錯 */
  function pick(stage, btn) {
    if (btn.disabled) return;
    const side = btn.dataset.side;

    if (!st.sel) {
      st.sel = { side: side, btn: btn };
      btn.classList.add('sel');
      JPQ.sfx.click();
      return;
    }
    if (st.sel.side === side) {
      st.sel.btn.classList.remove('sel');
      st.sel = { side: side, btn: btn };
      btn.classList.add('sel');
      return;
    }

    const prev = st.sel.btn;
    prev.classList.remove('sel');
    st.sel = null;

    const same = prev.dataset.t === btn.dataset.t && prev.dataset.k === btn.dataset.k;

    if (same) {
      prev.classList.add('hit');
      btn.classList.add('hit');
      prev.disabled = btn.disabled = true;
      st.done++;
      st.roundDone++;
      st.score += 10;
      JPQ.sfx.match();
      JPQ.stats.answer('形:' + prev.dataset.k, true);
      paint(stage);
      if (st.done % 4 === 0) JPQ.fx.burst(global.innerWidth / 2, 240, 50);
      if (st.roundDone === PAIRS_PER_ROUND) endRound(stage, false);
    } else {
      st.mistakes++;
      st.roundWrong++;
      st.score = Math.max(0, st.score - 3);
      prev.classList.add('miss');
      btn.classList.add('miss');
      JPQ.sfx.wrong();
      JPQ.stats.answer('形:' + prev.dataset.k, false);

      const f = verb.form(prev.dataset.k);
      const fb = U.$('#fb', stage);
      if (fb) {
        fb.className = 'fb show no';
        fb.innerHTML = `<strong>${U.ruby(prev.dataset.t)}</strong> 是 <b>${f.label}</b>，
          規則是「${f.hint}」`;
      }
      paint(stage);
      setTimeout(() => prev.classList.remove('miss'), 480);
      setTimeout(() => btn.classList.remove('miss'), 480);
    }
  }

  function paint(stage) {
    const total = ROUNDS.length * PAIRS_PER_ROUND;
    JPQ.hud.progress(st.done / total);
    JPQ.hud.pills([
      { label: '配對', value: st.done + '/' + total },
      { label: '分數', value: st.score },
      { label: '時間', value: st.time + 's', cls: st.time <= 10 ? 'time danger' : 'time' }
    ]);
  }

  function endRound(stage, timeout) {
    stop();
    const last = st.r >= ROUNDS.length - 1;
    const next = () => {
      JPQ.modal.close();
      if (last) finish(stage);
      else { st.r++; round(stage); }
    };
    if (last) return next();

    JPQ.modal.show({
      title: '第 ' + (st.r + 1) + ' 回合完成',
      html: timeout
        ? '<p>時間到了！沒配到的題目就當複習題。</p>'
        : `${PAIRS_PER_ROUND} 組都配對成功，繼續下一回合！`,
      actions: [{ label: '下一回合 →', onClick: next }]
    });
  }

  function finish(stage) {
    stop();
    JPQ.store.setRecord('verb-match', st.score);
    JPQ.stats.run('verb-match', st.done + st.mistakes, st.done);
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
          <div>最高分<b>${JPQ.store.record('verb-match')}</b></div>
        </div>`,
      actions: [
        { label: '🏆 登記排行榜', cls: 'gold', onClick: () => {
            JPQ.modal.close();
            JPQ.lb.offer('verb-match', st.score, '配對 ' + st.done + ' · 失誤 ' + st.mistakes);
          } },
        { label: '再玩一次', onClick: () => { JPQ.modal.close(); begin(stage); } },
        { label: '回主頁', cls: 'grey', onClick: () => { JPQ.modal.close(); JPQ.go('#/'); } }
      ]
    });
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  JPQ.registerGame({
    name: 'verb-match',
    title: '活用配對',
    sub: '把活用形和詞形配起來',
    card: {
      thumb: 'link',
      icon: '🔗',
      color: '#8ec5f5',
      title: '活用配對',
      desc: '一邊是活用形名稱、一邊是詞形，最後一回合專挑書冊上最像的那幾組。',
      tag: ROUNDS.length * PAIRS_PER_ROUND + ' 組'
    },
    best: () => {
      const b = JPQ.store.record('verb-match');
      return b ? `最高分 <b>${b}</b>` : '';
    },
    mount(stage) { intro(stage); },
    unmount: stop
  });

})(window);
