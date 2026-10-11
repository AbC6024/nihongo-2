/* =========================================================
   五十音特訓 — 四種玩法
   看字選音 / 看音選字 / 聽音辨識 / 配對記憶
   每種玩法都能切換字集：平假名 / 片假名 / 單字
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;

/* 語音改用 core.js 的 JPQ.speech（動詞遊戲也要用同一份） */
  const speech = JPQ.speech;

  /* ---------------- 共用介面狀態（在四款玩法之間保留） ---------------- */
  const ui = { pool: 'katakana', quizRounds: 10, matchPairs: 5 };

  const POOL_KEYS = ['katakana', 'hiragana', 'vocabulary'];

  const ROUND_SETS = {
    quiz: [{ v: 10, label: '10 題' }, { v: 20, label: '20 題' }, { v: 0, label: '全部' }],
    match: [{ v: 4, label: '4 組' }, { v: 5, label: '5 組' },
            { v: 6, label: '6 組' }, { v: 8, label: '8 組' }]
  };

  const pool = () => JPQ.kanaPool[ui.pool];

  /* 0 代表「整組出完」，實際題數看字集大小 */
  const quizTotal = () => ui.quizRounds || pool().items.length;

  const esc = text => U.escapeHTML(text);

  /* 答完之後顯示的那一行說明 */
  function detail(item) {
    return item.zh
      ? `${esc(item.zh)}（${esc(item.speak)}）　·　${esc(item.tag)}`
      : `${esc(item.char)}（${esc(item.roman)}）　·　${esc(item.tag)}`;
  }

  /* ---------------- 字集／題數切換器 ---------------- */
  function barHTML(kind) {
    const cur = kind === 'match' ? ui.matchPairs : ui.quizRounds;
    return `<div class="drill-bar">
      <div class="drill-field">
        <span class="drill-lab">字集</span>
        <div class="drill-seg">
          ${POOL_KEYS.map(k => `<button type="button" data-pool="${k}"${ui.pool === k ? ' class="on"' : ''}>${JPQ.kanaPool[k].label}</button>`).join('')}
        </div>
      </div>
      <div class="drill-field">
        <span class="drill-lab">${kind === 'match' ? '每關' : '題數'}</span>
        <div class="drill-seg">
          ${ROUND_SETS[kind].map(o => `<button type="button" data-round="${o.v}"${cur === o.v ? ' class="on"' : ''}>${o.label}</button>`).join('')}
        </div>
      </div>
      <span class="drill-note">切換設定會重新開始</span>
    </div>`;
  }

  function wireBar(stage, kind, restart) {
    U.$$('[data-pool]', stage).forEach(b => b.addEventListener('click', () => {
      if (ui.pool === b.dataset.pool) return;
      JPQ.sfx.click();
      ui.pool = b.dataset.pool;
      restart(stage);
    }));
    U.$$('[data-round]', stage).forEach(b => b.addEventListener('click', () => {
      const v = Number(b.dataset.round);
      if ((kind === 'match' ? ui.matchPairs : ui.quizRounds) === v) return;
      JPQ.sfx.click();
      if (kind === 'match') ui.matchPairs = v; else ui.quizRounds = v;
      restart(stage);
    }));
  }

  /* ---------------- 出一題（1 個正解 + 3 個干擾項） ---------------- */
  function question(keyFn, distractCount) {
    const items = pool().items;
    const q = U.pick(items);
    const others = U.shuffle(items.filter(x => keyFn(x) !== keyFn(q)));
    const opts = others.slice(0, Math.min(distractCount, others.length)).concat([q]);
    return { q: q, opts: U.shuffle(opts) };
  }

  /* 語音的小播放鈕，瀏覽器沒有語音功能時就不顯示 */
  function speakBtn() {
    if (!speech.available()) return '';
    return `<div class="center" style="margin-bottom:16px">
      <button class="btn ghost" id="speakBtn" type="button">🔊 聽發音</button>
    </div>`;
  }

  /* 結算畫面（兩種引擎共用） */
  function resultHTML(opt) {
    return `<div class="panel narrow center">
      <h2>${opt.title}　完成！</h2>
      <div class="result-score">${opt.score}</div>
      <p class="section-note">${esc(opt.subtitle)}</p>
      <div class="result-row">
        ${opt.rows.map(r => `<div>${esc(r[0])}<b>${esc(String(r[1]))}</b></div>`).join('')}
      </div>
      ${opt.best ? '<p class="q-hint" style="margin-top:16px">🏆 刷新個人最佳！</p>' : ''}
      <div class="btn-row">
        <button class="btn gold" id="rankBtn">🏆 登記排行榜</button>
        <button class="btn" id="againBtn">再玩一次</button>
        <button class="btn grey" id="backBtn">回列表</button>
      </div>
    </div>`;
  }

  function wireResult(stage, def, score, detailText, again) {
    const rank = U.$('#rankBtn', stage);
    if (rank) rank.addEventListener('click', () => JPQ.lb.offer(def.name, score, detailText));
    U.$('#againBtn', stage).addEventListener('click', again);
    U.$('#backBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); JPQ.go('#/'); });
  }

  /* =======================================================
     共用測驗引擎：看字選音 / 看音選字 / 聽音辨識
     ======================================================= */
  function quizGame(def) {
    let st = null, stopKeys = null, alive = false;

    function sync() {
      if (!st || st.synced || !st.total) return;
      st.synced = true;
      JPQ.stats.run(def.name, st.total, st.right);
    }

    function newRound(stage) {
      st = {
        total: 0, right: 0, streak: 0, best: 0, score: 0,
        q: null, opts: [], locked: false, synced: false
      };
      draw(stage);
    }

    function draw(stage) {
      const r = question(def.key, 3);
      st.q = r.q; st.opts = r.opts; st.locked = false;
      const view = def.ask(st.q);

      stage.innerHTML = `<div class="panel">
        ${barHTML('quiz')}
        ${def.player || ''}
        <div class="q-zh">${view.zh}</div>
        <div class="q-sentence"><span class="kana-big ${view.cls || ''}">${esc(view.main)}</span></div>
        ${view.note ? `<div class="q-hint">${esc(view.note)}</div>` : ''}
        ${def.speak === false ? '' : speakBtn()}
        <div class="opt-grid">
          ${st.opts.map((o, i) => `<button class="opt ${def.optCls || ''}" type="button" data-i="${i}">
            <span class="key">${i + 1}</span>${esc(def.label(o))}</button>`).join('')}
        </div>
        <div class="fb"></div>
      </div>`;

      wireBar(stage, 'quiz', newRound);

      const say = () => speech.say(st.q.speak);
      const sb = U.$('#speakBtn', stage);
      if (sb) sb.addEventListener('click', () => { JPQ.sfx.click(); say(); });
      const pb = U.$('#playBtn', stage);
      if (pb) pb.addEventListener('click', () => { JPQ.sfx.click(); say(); });

      paint();

      U.$$('.opt', stage).forEach(b =>
        b.addEventListener('click', () => answer(b, stage)));

      if (stopKeys) stopKeys();
      stopKeys = JPQ.onKey(e => {
        const n = parseInt(e.key, 10);
        const b = U.$$('.opt', stage)[n - 1];
        if (b && !b.disabled) answer(b, stage);
      });

      /* 自動播放：離開玩法之後就不要在背景說話了 */
      if (def.autoPlay) setTimeout(() => { if (alive) say(); }, 350);
    }

    function answer(btn, stage) {
      if (st.locked) return;
      st.locked = true;

      const ok = st.opts[Number(btn.dataset.i)] === st.q;
      U.$$('.opt', stage).forEach(b => { b.disabled = true; });
      st.total++;

      if (ok) {
        const gained = 10 + st.streak * 2;
        st.score += gained;
        st.streak++;
        st.right++;
        st.best = Math.max(st.best, st.streak);
        JPQ.store.setRecord(def.name + '-best', st.score);
        JPQ.sfx.correct();
        btn.classList.add('correct');
      } else {
        st.streak = 0;
        JPQ.sfx.wrong();
        btn.classList.add('wrong');
      }

      U.$$('.opt', stage).forEach(b => {
        if (b === btn) return;
        if (st.opts[Number(b.dataset.i)] === st.q) b.classList.add('correct');
        else b.classList.add('dim');
      });

      speech.say(st.q.speak);
      paint();

      const done = st.total >= quizTotal();
      const fb = U.$('.fb', stage);
      fb.className = 'fb show ' + (ok ? 'ok' : 'no');
      fb.innerHTML = `<strong>${ok
        ? '答對了！' + (st.streak > 1 ? '　連擊 ' + st.streak : '')
        : '答案是「' + esc(def.label(st.q)) + '」'}</strong>
        <p>${detail(st.q)}</p>
        <div class="btn-row">
          <button class="btn ghost" id="replayBtn">再聽一次</button>
          <button class="btn" id="nextBtn">${done ? '看成績 →' : '下一題 →'}</button>
        </div>`;

      U.$('#replayBtn', fb).addEventListener('click', () => speech.say(st.q.speak));
      U.$('#nextBtn', fb).addEventListener('click', () => done ? finish(stage) : draw(stage));
    }

    function paint() {
      JPQ.hud.progress(quizTotal() ? st.total / quizTotal() : 0);
      JPQ.hud.pills([
        { label: '得分', value: st.score },
        { label: '答對', value: st.right + ' / ' + st.total },
        { label: '連勝', value: st.streak, cls: st.streak >= 3 ? 'combo' : '' }
      ]);
    }

    function finish(stage) {
      sync();
      const rate = st.total ? Math.round(st.right / st.total * 100) : 0;
      const isBest = st.score > 0 && st.score >= JPQ.store.record(def.name + '-best');

      stage.innerHTML = resultHTML({
        title: def.title,
        score: st.score,
        subtitle: `${pool().label}　·　${quizTotal()} 題`,
        rows: [['答對', st.right], ['正確率', rate + '%'], ['最高連擊', st.best]],
        best: isBest
      });

      if (isBest) JPQ.sfx.levelup();
      wireResult(stage, def, st.score,
        `${pool().label}　答對 ${st.right}/${st.total}`, () => newRound(stage));
    }

    return {
      name: def.name,
      title: def.title,
      sub: def.sub,
      mount: function (stage) {
        if (stopKeys) { stopKeys(); stopKeys = null; }
        alive = true;
        speech.init();
        JPQ.hud.set(def.title, def.sub);
        newRound(stage);
      },
      unmount: function () {
        alive = false;
        sync();
        if (stopKeys) { stopKeys(); stopKeys = null; }
        speech.stop();
      }
    };
  }

  /* ---------------- 玩法一：看字選音 ---------------- */
  const readGame = quizGame({
    name: 'kana-read',
    title: '看字選音',
    sub: '看到字，選讀音',
    key: it => it.roman,
    label: it => it.roman,
    optCls: 'romaji',
    ask: it => ({
      zh: it.zh ? '看到這個單字，選出正確的讀音' : '看到這個假名，選出正確的讀音',
      main: it.char,
      note: it.zh ? `${it.zh}　·　${it.tag}` : `出現在「${it.tag}」`
    })
  });

  /* ---------------- 玩法二：看音選字 ---------------- */
  const writeGame = quizGame({
    name: 'kana-write',
    title: '看音選字',
    sub: '看到讀音，選對應的字',
    key: it => it.char,
    label: it => it.char,
    ask: it => ({
      zh: it.zh ? '看到讀音，選出對應的單字' : '看到讀音，選出對應的假名',
      main: it.roman,
      cls: 'romaji',
      note: it.zh ? `分類：${it.tag}` : `出現在「${it.tag}」`
    })
  });

  /* ---------------- 玩法三：聽音辨識 ---------------- */
  const listenGame = quizGame({
    name: 'kana-listen',
    title: '聽音辨識',
    sub: '聽發音，選出對應的字',
    key: it => it.char,
    label: it => it.char,
    speak: false,
    autoPlay: true,
    player: `<div class="center" style="margin:6px 0 22px">
      <button class="btn drill-play" id="playBtn" type="button">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3l4.5-3.5v12L7 14.5H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18 6.7a7.5 7.5 0 0 1 0 10.6"/></svg>
        播放
      </button>
      <p class="q-hint" style="margin-top:12px">聽不出來就按「再聽一次」，或直接猜一個</p>
    </div>`,
    ask: () => ({ zh: '聽聽看是哪一個字', main: '？', cls: 'is-blank' })
  });

  /* =======================================================
     玩法四：配對記憶（左邊的字配上右邊的讀音）
     ======================================================= */
  function matchGame() {
    const name = 'kana-match';
    let st = null;

    function sync() {
      if (!st || st.synced || !st.judged) return;
      st.synced = true;
      JPQ.stats.run(name, st.judged, st.hit);
    }

    function newBoard(stage) {
      const items = pool().items;
      const count = Math.min(ui.matchPairs, items.length);
      const chosen = U.shuffle(items).slice(0, count);

      st = {
        left: U.shuffle(chosen), right: U.shuffle(chosen),
        count: count, matched: 0, selL: -1, selR: -1,
        score: 0, streak: 0, best: 0,
        judged: 0, hit: 0, locked: false, synced: false
      };

      stage.innerHTML = `<div class="panel">
        ${barHTML('match')}
        <div class="q-zh">先點左邊的字，再點右邊的讀音</div>
        <div class="match-wrap">
          ${st.left.map((it, i) => `<button class="mtile" type="button" data-side="L" data-i="${i}" style="grid-row:${i + 1}"><span class="ptext">${esc(it.char)}</span></button>`).join('')}
          <span class="mid-label" style="grid-row:1">↔</span>
          ${st.right.map((it, i) => `<button class="mtile" type="button" data-side="R" data-i="${i}" style="grid-row:${i + 1}"><span class="ptext">${esc(it.roman)}</span></button>`).join('')}
        </div>
        <div class="fb"></div>
        <p class="q-hint" style="margin-top:16px">配對失敗不會扣分，慢慢想　·　點左邊的字會念出來</p>
      </div>`;

      wireBar(stage, 'match', newBoard);
      paint();

      U.$$('.mtile', stage).forEach(b =>
        b.addEventListener('click', () => select(b, stage)));
    }

    function tile(stage, side, i) {
      return U.$(`.mtile[data-side="${side}"][data-i="${i}"]`, stage);
    }

    function select(btn, stage) {
      if (st.locked || btn.disabled) return;
      const side = btn.dataset.side;
      const i = Number(btn.dataset.i);
      const slot = side === 'L' ? 'selL' : 'selR';

      /* 再點一次同一張就取消選取 */
      if (st[slot] === i) {
        st[slot] = -1;
        btn.classList.remove('sel');
        return;
      }

      if (st[slot] >= 0) {
        const old = tile(stage, side, st[slot]);
        if (old) old.classList.remove('sel');
      }
      st[slot] = i;
      btn.classList.add('sel');
      if (side === 'L') speech.say(st.left[i].speak);

      if (st.selL >= 0 && st.selR >= 0) judge(stage);
    }

    function judge(stage) {
      const li = st.selL, ri = st.selR;
      const leftBtn = tile(stage, 'L', li);
      const rightBtn = tile(stage, 'R', ri);
      const fb = U.$('.fb', stage);
      const board = st;
      st.judged++;

      if (st.left[li].char === st.right[ri].char) {
        st.hit++;
        st.matched++;
        const gained = 10 + st.streak * 2;
        st.score += gained;
        st.streak++;
        st.best = Math.max(st.best, st.streak);
        JPQ.store.setRecord(name + '-best', st.score);
        JPQ.sfx.match();
        [leftBtn, rightBtn].forEach(b => {
          b.classList.remove('sel');
          b.classList.add('hit');
          b.disabled = true;
        });
        st.selL = st.selR = -1;
        fb.className = 'fb show ok';
        fb.innerHTML = `<strong>配對成功！</strong><p>${detail(st.left[li])}</p>`;
        paint();
        if (st.matched >= st.count) {
          setTimeout(() => { if (st === board) finish(stage); }, 800);
        }
      } else {
        st.streak = 0;
        st.locked = true;
        JPQ.sfx.wrong();
        leftBtn.classList.add('miss');
        rightBtn.classList.add('miss');
        fb.className = 'fb show no';
        fb.innerHTML = `<strong>不是這個配對</strong>
          <p>${esc(st.left[li].char)} 讀作 ${esc(st.left[li].roman)}</p>`;
        paint();
        setTimeout(() => {
          /* 這 900 毫秒內玩家可能已經重開或切換玩法 */
          if (st !== board) return;
          [leftBtn, rightBtn].forEach(b => b && b.classList.remove('miss', 'sel'));
          st.selL = st.selR = -1;
          st.locked = false;
        }, 900);
      }
    }

    function paint() {
      JPQ.hud.progress(st.count ? st.matched / st.count : 0);
      JPQ.hud.pills([
        { label: '得分', value: st.score },
        { label: '配對', value: st.matched + ' / ' + st.count },
        { label: '連勝', value: st.streak, cls: st.streak >= 3 ? 'combo' : '' }
      ]);
    }

    function finish(stage) {
      sync();
      const rate = st.judged ? Math.round(st.hit / st.judged * 100) : 0;
      const isBest = st.score > 0 && st.score >= JPQ.store.record(name + '-best');
      const def = { name: name };

      stage.innerHTML = resultHTML({
        title: '配對記憶',
        score: st.score,
        subtitle: `${pool().label}　·　${st.count} 組`,
        rows: [['配對成功', st.hit], ['成功率', rate + '%'], ['最高連勝', st.best]],
        best: isBest
      });

      if (isBest) JPQ.sfx.levelup();
      wireResult(stage, def, st.score,
        `${pool().label}　配對 ${st.hit}/${st.count}`, () => newBoard(stage));
    }

    return {
      name: name,
      title: '配對記憶',
      sub: '左邊的字配上右邊的讀音',
      mount: function (stage) {
        speech.init();
        JPQ.hud.set('配對記憶', '左邊的字配上右邊的讀音');
        newBoard(stage);
      },
      unmount: function () { sync(); speech.stop(); }
    };
  }

  /* ---------------- 註冊 ---------------- */
  function reg(def) {
    JPQ.registerGame({
      name: def.name,
      title: def.title,
      sub: def.sub,
      card: {
        icon: def.icon, color: def.color, thumb: def.thumb,
        title: def.title, tag: def.tag, desc: def.desc
      },
      best: function () {
        const v = JPQ.store.record(def.name + '-best');
        return v ? `最佳 <b>${v}</b> 分` : '';
      },
      mount: def.mount,
      unmount: def.unmount
    });
  }

  reg({ ...readGame, icon: '👀', color: '#f5a9c0', thumb: 'quiz',
        tag: '三種字集', desc: '看到平假名、片假名或單字，選出它的讀音。' });

  reg({ ...writeGame, icon: '🔤', color: '#7fc4f0', thumb: 'tiles',
        tag: '三種字集', desc: '看到羅馬拼音，選出對應的假名或單字。' });

  reg({ ...listenGame, icon: '👂', color: '#8fd6b8', thumb: 'listen',
        tag: '需要語音', desc: '播放日文發音，從四個選項中選出對應的字。' });

  reg({ ...matchGame(), icon: '🧩', color: '#c4a8f2', thumb: 'cards',
        tag: '記憶練習', desc: '左右兩欄配對，全部配對成功就過關。' });
})(window);