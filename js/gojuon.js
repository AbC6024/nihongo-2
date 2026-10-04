/* =========================================================
   五十音圖 — 三種玩法
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;

  /* ---------------- 語音（Web Speech API） ---------------- */
  const speech = {
    ready: false,
    voice: null,
    init() {
      if (typeof global.speechSynthesis === 'undefined') return;
      const load = () => {
        const vs = global.speechSynthesis.getVoices() || [];
        this.voice = vs.find(v => /^ja[-_]JP/i.test(v.lang)) || null;
        this.ready = true;
      };
      load();
      if (global.speechSynthesis.onvoiceschanged !== undefined) {
        global.speechSynthesis.onvoiceschanged = load;
      }
    },
    available() { return typeof global.speechSynthesis !== 'undefined'; },
    say(text) {
      if (!this.available()) return;
      try {
        global.speechSynthesis.cancel();
        const u = new global.SpeechSynthesisUtterance(text);
        u.lang = 'ja-JP';
        u.rate = .8;
        if (this.voice) u.voice = this.voice;
        global.speechSynthesis.speak(u);
      } catch (e) { /* 沒有語音時靜默 */ }
    }
  };

  function clearKeys() {
    if (U.__kanaKey) { U.__kanaKey(); U.__kanaKey = null; }
  }

  /* =======================================================
     玩法 A：五十音順序
     ======================================================= */
  function orderGame() {
    let st = null;

    function newRound(stage) {
      /* all 依五十音圖順序排列，所以任何連續片段都是合法的順序題 */
      const all = JPQ.kana.list();
      const size = Math.min(U.pick([4, 5, 6]), all.length);
      const start = Math.floor(Math.random() * (all.length - size + 1));
      const target = all.slice(start, start + size);

      st = {
        target: target, pool: U.shuffle(target.slice()), placed: [],
        hintUsed: false,
        total: (st ? st.total : 0), right: (st ? st.right : 0),
        streak: (st ? st.streak : 0), best: (st ? st.best : 0)
      };
      draw(stage);
    }

    function draw(stage) {
      const answered = st.target.length;
      stage.innerHTML = `<div class="panel">
        <div class="q-zh" style="text-align:left">依照五十音的順序，點出正確的排列。</div>
        <div class="q-sentence" style="font-size:18px;letter-spacing:.14em" id="answerSlot">
          <span style="color:#a8adC4">${'？'.repeat(answered)}</span>
        </div>
        <div class="kanapool" id="kanapool"></div>
        <div class="scr-tools">
          <button class="btn ghost" id="hintBtn">💡 提示（每題一次）</button>
          <button class="btn" id="checkBtn">檢查答案</button>
        </div>
      </div>`;

      U.$('#kanapool', stage).innerHTML = st.pool.map((k, i) =>
        `<button class="kana-tile" data-pool="${i}"><b>${k.hira}</b><em>${k.romaji}</em></button>`).join('');

      paint(stage);
      const hb = U.$('#hintBtn', stage);
      if (hb && st.hintUsed) { hb.disabled = true; hb.textContent = '已用過提示'; }
      U.$$('#kanapool .kana-tile', stage).forEach(b => b.addEventListener('click', () => {
        const i = Number(b.dataset.pool);
        st.placed.push(st.pool.splice(i, 1)[0]);
        JPQ.sfx.click();
        draw(stage);
      }));
      U.$('#hintBtn', stage).addEventListener('click', () => {
        if (st.hintUsed) return;
        const next = st.target.find((t, i) =>
          !st.placed.some(p => p.hira === t.hira) && st.pool.some(x => x.hira === t.hira));
        if (!next) return;
        st.placed.push(st.pool.splice(st.pool.findIndex(x => x.hira === next.hira), 1)[0]);
        st.hintUsed = true;
        JPQ.sfx.match();
        draw(stage);
        const btn = U.$('#hintBtn', stage);
        if (btn) { btn.disabled = true; btn.textContent = '已用過提示'; }
      });
      U.$('#checkBtn', stage).addEventListener('click', () => check(stage));
    }

    function paint(stage) {
      const slot = U.$('#answerSlot', stage);
      if (st.placed.length) {
        slot.innerHTML = st.placed.map(p => `<b>${p.hira}</b>`).join('<span style="color:#c9cee4">・</span>');
      } else {
        slot.innerHTML = `<span style="color:#a8adC4">${'？'.repeat(st.target.length)}</span>`;
      }
      U.$('#checkBtn', stage).disabled = st.placed.length !== st.target.length;
      JPQ.hud.pills([
        { label: '第', value: st.total + ' 題' },
        { label: '答對', value: st.right },
        { label: '連勝', value: st.streak, cls: st.streak >= 3 ? 'combo' : '' }
      ]);
    }

    function check(stage) {
      if (st.placed.length !== st.target.length) return;
      const ok = st.placed.every((p, i) => p.hira === st.target[i].hira);
      const slot = U.$('#answerSlot', stage);
      st.total++;
      if (ok) {
        st.right++; st.streak++;
        st.best = Math.max(st.best, st.streak);
        JPQ.store.setRecord('kana-order-best', st.best);
        slot.classList.add('good');
        JPQ.sfx.correct();
      } else {
        st.streak = 0;
        slot.classList.add('shake');
        JPQ.sfx.wrong();
      }
      U.$$('.scr-tools .btn', stage).forEach(b => b.disabled = true);
      slot.insertAdjacentHTML('afterend', `
        <div class="fb ${ok ? 'ok' : 'no'} show">
          <strong>${ok ? '正確！' : '正確順序是：' + st.target.map(t => t.hira).join(' → ')}</strong>
          <p>${ok ? '羅馬字：' + st.target.map(t => t.romaji).join(' / ') : '這一段的羅馬字：' + st.target.map(t => t.romaji).join(' / ')}</p>
        </div>
        <div class="btn-row"><button class="btn" id="nextBtn">下一題 →</button></div>`);
      paint(stage);
      U.$('#nextBtn', stage).addEventListener('click', () => newRound(stage));
    }

    /* 這款是無限題，每答一題就跟學習統計同步一次 */
    function syncStats() { JPQ.stats.run('kana-order', st.total, st.right); }

    return {
      name: 'kana-order',
      mount: function (stage) {
        clearKeys();
        speech.init();
        JPQ.hud.set('五十音順序', '排回正確順序');
        JPQ.hud.progress(0);
        JPQ.hud.pills([{ label: '第', value: '0 題' }, { label: '答對', value: 0 }]);
        newRound(stage);
      },
      unmount: function () { syncStats(); if (global.speechSynthesis) global.speechSynthesis.cancel(); }
    };
  }

  /* =======================================================
     玩法 B：平假名 ⇄ 片假名
     ======================================================= */
  function convertGame() {
    let st = null, reverse = false;

    function draw(stage) {
      const all = JPQ.kana.list();
      const q = U.pick(all);
      const distract = U.shuffle(all.filter(k => k.hira !== q.hira)).slice(0, 3);
      const opts = U.shuffle(distract.concat([q]));
      reverse = Math.random() < .5;
      st = {
        q: q, opts: opts,
        total: (st ? st.total : 0), right: (st ? st.right : 0),
        streak: (st ? st.streak : 0), best: (st ? st.best : 0)
      };

      stage.innerHTML = `<div class="panel">
        <div class="q-zh">${reverse ? '這個片假名，平假名怎麼寫？' : '這個平假名，片假名怎麼寫？'}</div>
        <div class="q-sentence"><span style="font-size:clamp(46px,10vw,86px)">${reverse ? q.kata : q.hira}</span></div>
        <div class="q-zh" style="margin-bottom:18px">${reverse ? '？' : q.romaji}</div>
        <div class="opt-grid" id="opts">
          ${opts.map((o, i) => `<button class="opt" data-o="${reverse ? o.hira : o.kata}">
            <span class="key">${i + 1}</span>${reverse ? o.hira : o.kata}</button>`).join('')}
        </div>
        <div class="fb" id="fb"></div>
      </div>`;

      paint(stage);
      U.$$('#opts .opt', stage).forEach(b => b.addEventListener('click', () => answer(b, stage)));
      clearKeys();
      U.__kanaKey = JPQ.onKey(e => {
        const n = parseInt(e.key, 10);
        const b = U.$$('#opts .opt', stage)[n - 1];
        if (b && !b.disabled) answer(b, stage);
      });
    }

    function answer(btn, stage) {
      U.$$('#opts .opt', stage).forEach(b => b.disabled = true);
      const want = reverse ? st.q.hira : st.q.kata;
      const ok = btn.dataset.o === want;
      st.total++;
      if (ok) {
        st.right++;
        st.streak++;
        st.best = Math.max(st.best, st.streak);
        JPQ.store.setRecord('kana-convert-best', st.best);
        JPQ.sfx.correct(); btn.classList.add('correct');
      } else {
        st.streak = 0;
        JPQ.sfx.wrong(); btn.classList.add('wrong');
      }

      U.$$('#opts .opt', stage).forEach(b => {
        if (b.dataset.o === want && b !== btn) b.classList.add('correct');
        else if (b !== btn) b.classList.add('dim');
      });
      speech.say(st.q.hira);
      const fb = U.$('#fb', stage);
      fb.className = 'fb show ' + (ok ? 'ok' : 'no');
      fb.innerHTML = `<strong>${ok ? '答對了！' : '正確答案是「' + want + '」'}</strong>
        <p>${st.q.hira}（${st.q.romaji}）＝ ${st.q.kata}　·　出現在「${st.q.row}」</p>
        <div class="btn-row"><button class="btn" id="nextBtn">下一題 →</button></div>`;
      U.$('#nextBtn', stage).addEventListener('click', () => draw(stage));
      paint(stage);
    }

    function paint() {
      JPQ.hud.progress(st ? st.right / Math.max(1, st.total) : 0);
        JPQ.hud.pills([{ label: '題數', value: st ? st.total : 0 }, { label: '答對', value: st ? st.right : 0 }]);
    }

    return {
      name: 'kana-convert',
      mount: function (stage) {
        clearKeys();
        speech.init();
        st = { total: 0, right: 0, streak: 0, best: 0 };
        JPQ.hud.set('平假名 ⇄ 片假名', '看字選另一種寫法');
        draw(stage);
      },
      unmount: function () {
        clearKeys();
        if (st && st.total) JPQ.stats.run('kana-convert', st.total, st.right);
        if (global.speechSynthesis) global.speechSynthesis.cancel();
      }
    };
  }

  /* =======================================================
     玩法 C：聽音選字
     ======================================================= */
  function listenGame() {
    let st = null;

    function draw(stage) {
      if (!speech.available()) {
        stage.innerHTML = `<div class="panel narrow center">
          <h2>聽音選字</h2>
          <p class="section-note" style="margin-top:12px">
            這個瀏覽器沒有語音功能（Web Speech API），所以這個玩法不能用。<br>
            請改用 Chrome 或 Edge，並確認系統有安裝日語語音套件。
          </p>
          <div class="btn-row"><button class="btn grey" id="backBtn">回列表</button></div>
        </div>`;
        U.$('#backBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); JPQ.go('#/'); });
        return;
      }

      const all = JPQ.kana.list();
      const q = U.pick(all);
      const opts = U.shuffle(U.shuffle(all.filter(k => k.romaji !== q.romaji)).slice(0, 3).concat([q]));
      st = {
        q: q, opts: opts,
        total: (st ? st.total : 0), right: (st ? st.right : 0),
        streak: (st ? st.streak : 0), best: (st ? st.best : 0)
      };

      stage.innerHTML = `<div class="panel">
        <div class="q-zh">聽聽看是哪一個假名</div>
        <div class="center" style="margin:6px 0 22px">
          <button class="btn" id="playBtn" style="font-size:19px;padding:16px 34px">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px"><path d="M4 9.5h3l4.5-3.5v12L7 14.5H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18 6.7a7.5 7.5 0 0 1 0 10.6"/></svg>
            播放
          </button>
          <p class="q-hint" style="margin-top:12px">聽不出來可以按「看答案」</p>
        </div>
        <div class="opt-grid" id="opts">
          ${opts.map((o, i) => `<button class="opt" data-o="${o.romaji}">
            <span class="key">${i + 1}</span>${o.hira}</button>`).join('')}
        </div>
        <div class="fb" id="fb"></div>
      </div>`;

      paint();
      U.$('#playBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); speech.say(st.q.hira); });
      U.$$('#opts .opt', stage).forEach(b => b.addEventListener('click', () => answer(b, stage)));
      clearKeys();
      U.__kanaKey = JPQ.onKey(e => {
        const n = parseInt(e.key, 10);
        const b = U.$$('#opts .opt', stage)[n - 1];
        if (b && !b.disabled) answer(b, stage);
      });
      setTimeout(() => speech.say(st.q.hira), 350);
    }

    function answer(btn, stage) {
      U.$$('#opts .opt', stage).forEach(b => b.disabled = true);
      const ok = btn.dataset.o === st.q.romaji;
      st.total++;
      if (ok) {
        st.right++;
        st.streak++;
        st.best = Math.max(st.best, st.streak);
        JPQ.store.setRecord('kana-listen-best', st.best);
        JPQ.sfx.correct(); btn.classList.add('correct');
      } else {
        st.streak = 0;
        JPQ.sfx.wrong(); btn.classList.add('wrong');
      }
      U.$$('#opts .opt', stage).forEach(b => {
        if (b.dataset.o === st.q.romaji && b !== btn) b.classList.add('correct');
        else if (b !== btn) b.classList.add('dim');
      });
      const fb = U.$('#fb', stage);
      fb.className = 'fb show ' + (ok ? 'ok' : 'no');
      fb.innerHTML = `<strong>${ok ? '答對了！' : '答案是「' + st.q.hira + '」'}</strong>
        <p>${st.q.hira}（${st.q.romaji}）／${st.q.kata}　·　出現在「${st.q.row}」</p>
        <div class="btn-row">
          <button class="btn ghost" id="replayBtn">再聽一次</button>
          <button class="btn" id="nextBtn">下一題 →</button>
        </div>`;
      U.$('#replayBtn', stage).addEventListener('click', () => speech.say(st.q.hira));
      U.$('#nextBtn', stage).addEventListener('click', () => draw(stage));
      paint();
    }

    function paint() {
      JPQ.hud.progress(st ? st.right / Math.max(1, st.total) : 0);
      JPQ.hud.pills([
        { label: '題數', value: st ? st.total : 0 },
        { label: '答對', value: st ? st.right : 0 },
        { label: '連勝', value: st ? st.streak : 0, cls: (st && st.streak >= 3) ? 'combo' : '' }
      ]);
    }

    return {
      name: 'kana-listen',
      mount: function (stage) {
        clearKeys();
        speech.init();
        st = { total: 0, right: 0, streak: 0, best: 0 };
        JPQ.hud.set('聽音選字', '聽發音選假名');
        draw(stage);
      },
      unmount: function () {
        clearKeys();
        if (st && st.total) JPQ.stats.run('kana-listen', st.total, st.right);
        if (global.speechSynthesis) global.speechSynthesis.cancel();
      }
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
        return v ? `最佳 <b>${v}</b> 次` : '';
      },
      mount: def.mount,
      unmount: def.unmount
    });
  }

  reg({ ...orderGame(), title: '五十音順序', sub: '排回正確順序',
        icon: '🔢', color: '#f5a9c0', thumb: 'quiz', tag: '無限題', desc: '把打亂的假名點回五十音的正確順序。' });

  reg({ ...convertGame(), title: '平假名 ⇄ 片假名', sub: '看字選另一種寫法',
        icon: '🔁', color: '#7fc4f0', thumb: 'tiles', tag: '雙向題', desc: '看到平假名選片假名，也會反過來出題。' });

  reg({ ...listenGame(), title: '聽音選字', sub: '聽發音選假名',
        icon: '🔊', color: '#8fd6b8', thumb: 'listen', tag: '需要語音', desc: '播放假名的發音，從四個選項中選出對應的假名。' });
})(window);
