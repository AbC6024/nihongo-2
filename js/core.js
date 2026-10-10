/* =========================================================
   助詞大冒險 — 共用核心（工具 / 存檔 / 音效 / HUD / 彈窗 / 路由）
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ = global.JPQ || {};

  /* ---------------- 小工具 ---------------- */
  const U = JPQ.util = {
    $: (sel, root) => (root || document).querySelector(sel),
    $$: (sel, root) => Array.from((root || document).querySelectorAll(sel)),

    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    clamp(n, min, max) { return Math.max(min, Math.min(max, n)); },
    pad(n) { return n < 10 ? '0' + n : '' + n; },
    escapeHTML(text) {
      return String(text == null ? '' : text).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
    },

    /* 題庫寫法：東京[とうきょう] → 假名標在「東京」正上方 */
    ruby(text) {
      return String(text).replace(
        /([一-龯々〆〇0-9]+)\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
    },
    /* 去掉注音標記，只留漢字本體（比對題目時用） */
    strip(text) {
      return String(text).replace(/([一-龯々〆〇0-9]+)\[([^\]]+)\]/g, '$1');
    },
    /* 把 "__" 換成 <span class="blank">，同時處理漢字注音 */
    blanked(text) {
      return U.ruby(text).replace(/__/g, '<span class="blank">？</span>');
    },
    fillBlank(text, ans, cls) {
      return U.ruby(text).replace(/__/, `<span class="blank ${cls || ''}">${ans}</span>`);
    },
    stars(n, total) {
      total = total || 3;
      let s = '';
      for (let i = 0; i < total; i++) s += i < n ? '★' : '<span class="off">★</span>';
      return s;
    }
  };

  /* ---------------- 進度儲存 ---------------- */
  const KEY = 'jpq.progress.v1';

  /* 學習統計的資料格式：
     runs   每玩一場記一筆 { game, at, total, right }
     acc    每個助詞的累計答題 { correct, total }
     days   有練習的日期（YYYY-MM-DD），用來算連續天數 */
  function emptyStats() { return { runs: [], acc: {}, days: [] }; }

  const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  };

  const stats = JPQ.stats = {
    /* 記一場遊戲結果 */
    run(game, total, right) {
      const d = store.load();
      if (!d.stats) d.stats = emptyStats();
      const t = Math.max(0, Number(total) || 0);
      const r = Math.max(0, Math.min(t, Number(right) || 0));

      d.stats.runs.push({ game: game, at: Date.now(), total: t, right: r });
      /* 只留最近 500 場，避免 localStorage 爆掉 */
      if (d.stats.runs.length > 500) d.stats.runs = d.stats.runs.slice(-500);

      const day = today();
      if (d.stats.days.indexOf(day) === -1) {
        d.stats.days.push(day);
        if (d.stats.days.length > 400) d.stats.days = d.stats.days.slice(-400);
      }
      store.save();
    },

    /* 記一題的助詞表現，particle 是助詞本身（は／が／を…） */
    answer(particle, ok) {
      if (!particle) return;
      const d = store.load();
      if (!d.stats) d.stats = emptyStats();
      const acc = d.stats.acc;
      if (!acc[particle]) acc[particle] = { correct: 0, total: 0 };
      acc[particle].total++;
      if (ok) acc[particle].correct++;
      store.save();
    },

    /* 依日期算出連續天數（從今天或昨天往前算） */
    streak() {
      const d = store.load();
      if (!d.stats || !d.stats.days.length) return 0;
      const set = new Set(d.stats.days);
      const cur = new Date();
      /* 今天還沒練不算斷，從今天或昨天起算 */
      if (!set.has(today())) cur.setDate(cur.getDate() - 1);
      let n = 0;
      while (set.has(cur.getFullYear() + '-' + U.pad(cur.getMonth() + 1) + '-' + U.pad(cur.getDate()))) {
        n++;
        cur.setDate(cur.getDate() - 1);
      }
      return n;
    },

    reset() {
      const d = store.load();
      d.stats = emptyStats();
      store.save();
    }
  };

  const store = JPQ.store = {
    data: null,
    load() {
      if (this.data) return this.data;
      try { this.data = JSON.parse(localStorage.getItem(KEY)) || {}; }
      catch (e) { this.data = {}; }
      if (!this.data.levels) this.data.levels = {};
      if (!this.data.records) this.data.records = {};
      if (!this.data.stats) this.data.stats = emptyStats();
      return this.data;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* 無痕模式等 */ }
    },
    levelStars(no) { return this.load().levels[no] || 0; },
    setLevelStars(no, stars) {
      const d = this.load();
      if ((d.levels[no] || 0) < stars) { d.levels[no] = stars; this.save(); }
    },
    totalStars() {
      const d = this.load();
      return Object.keys(d.levels).reduce((s, k) => s + (d.levels[k] || 0), 0);
    },
    record(key) { return this.load().records[key] || 0; },
    setRecord(key, val) {
      const d = this.load();
      if ((d.records[key] || 0) < val) { d.records[key] = val; this.save(); }
    },
    reset() {
      this.data = { levels: {}, records: {}, stats: emptyStats() };
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };

  /* ---------------- 音效（WebAudio，不需檔案） ---------------- */
  const sfx = JPQ.sfx = {
    on: true,
    ctx: null,
    ensure() {
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        try { if (AC) this.ctx = new AC(); } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
      return this.ctx;
    },
    tone(freq, dur, type, vol, delay) {
      if (!this.on) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.14, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    click()  { this.tone(520, 0.06, 'triangle', 0.08); },
    correct(){ this.tone(784, 0.12, 'sine', 0.13); this.tone(1175, 0.16, 'sine', 0.1, 0.08); },
    wrong()  { this.tone(196, 0.16, 'sawtooth', 0.09); this.tone(147, 0.22, 'sawtooth', 0.08, 0.09); },
    match()  { this.tone(660, 0.09, 'sine', 0.12); this.tone(990, 0.12, 'sine', 0.1, 0.07); },
    levelup(){ [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.12, i * 0.09)); },
    tick()   { this.tone(1200, 0.03, 'square', 0.05); }
  };

  /* ---------------- 語音（Web Speech API，不需音檔） ---------------- */
  const speech = JPQ.speech = {
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
    stop() {
      if (!this.available()) return;
      try { global.speechSynthesis.cancel(); } catch (e) {}
    },
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

  /* ---------------- 遊戲註冊表 ---------------- */
  JPQ.games = {};
  JPQ.registerGame = function (def) { JPQ.games[def.name] = def; };

  /* ---------------- HUD ---------------- */
  const hud = JPQ.hud = {
    el: {},
    init() {
      this.el = {
        title: U.$('#hudTitle'),
        sub: U.$('#hudSub'),
        fill: U.$('#hudFill'),
        bar: U.$('.hud-bar'),
        right: U.$('#hudRight')
      };
      U.$('#hudBack').addEventListener('click', () => JPQ.go('#/'));
    },
    set(title, sub) {
      this.el.title.textContent = title || '';
      this.el.sub.textContent = sub || '';
    },
    progress(ratio) {
      const r = U.clamp(ratio || 0, 0, 1);
      this.el.fill.style.width = (r * 100) + '%';
      this.el.bar.classList.toggle('low', r <= 0.25);
    },
    /* pills: [{label, value, cls}] */
    pills(list) {
      this.el.right.innerHTML = (list || []).map(p =>
        `<span class="pill ${p.cls || ''}">${p.label ? p.label + ' ' : ''}${p.value}</span>`
      ).join('');
    },
    clearPills() { this.el.right.innerHTML = ''; }
  };

  /* ---------------- 彈窗 ---------------- */
  const modal = JPQ.modal = {
    show(opts) {
      const box = U.$('#modal');
      U.$('#modalTitle').textContent = opts.title || '';
      U.$('#modalBody').innerHTML = opts.html || '';
      const act = U.$('#modalActions');
      act.innerHTML = '';
      (opts.actions || [{ label: '好的' }]).forEach(a => {
        const b = document.createElement('button');
        b.className = 'btn ' + (a.cls || '');
        b.type = 'button';
        b.textContent = a.label;
        b.addEventListener('click', () => { JPQ.sfx.click(); if (a.onClick) a.onClick(); });
        act.appendChild(b);
      });
      box.classList.toggle('wide', !!opts.wide);
      box.classList.remove('hidden');
    },
    close() { U.$('#modal').classList.add('hidden'); }
  };
  document.addEventListener('click', e => {
    if (e.target && e.target.id === 'modal') JPQ.modal.close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') JPQ.modal.close();
  });

  /* ---------------- 撒花 ---------------- */
  const fx = JPQ.fx = {
    cv: null, ctx: null, parts: [], raf: 0,
    boot() { this.cv = U.$('#fx'); this.ctx = this.cv.getContext('2d'); },
    size() {
      this.cv.width = global.innerWidth;
      this.cv.height = global.innerHeight;
    },
    burst(x, y, n) {
      if (!this.ctx) return;
      this.size();
      this.cv.style.display = 'block';
      const colors = ['#a9b8f5', '#c9a8ee', '#f7b6ce', '#8fd8c4', '#a8d5f2', '#f8d49a'];
      n = n || 70;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 7;
        this.parts.push({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
          s: 4 + Math.random() * 6,
          c: U.pick(colors),
          life: 70 + Math.random() * 40,
          r: Math.random() * Math.PI,
          spin: (Math.random() - .5) * .2
        });
      }
      this.run();
    },
    run() {
      if (this.raf) return;
      const step = () => {
        this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
        this.parts = this.parts.filter(p => p.life > 0);
        this.parts.forEach(p => {
          p.x += p.vx; p.y += p.vy; p.vy += 0.16; p.life--; p.r += p.spin;
          this.ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 70));
          this.ctx.fillStyle = p.c;
          /* 輕輕左右搖擺，模擬花瓣落下 */
          this.ctx.save();
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate(p.r);
          this.ctx.beginPath();
          this.ctx.ellipse(0, 0, p.s * .5, p.s * .34, 0, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.restore();
        });
        this.ctx.globalAlpha = 1;
        if (this.parts.length) this.raf = requestAnimationFrame(step);
        else { this.raf = 0; this.cv.style.display = 'none'; }
      };
      this.raf = requestAnimationFrame(step);
    },
    center() { this.burst(global.innerWidth / 2, global.innerHeight * 0.42, 110); }
  };
  global.addEventListener('resize', () => { if (JPQ.fx.cv) JPQ.fx.size(); });

  /* ---------------- 路由 ---------------- */
  JPQ.go = function (hash) {
    if (location.hash === hash) JPQ.router();
    else location.hash = hash;
  };

  JPQ.router = function () {
    const raw = location.hash.replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    const home = U.$('#view-home');
    const game = U.$('#view-game');

    if (parts[0] === 'play' && JPQ.games[parts[1]]) {
      home.classList.add('hidden');
      game.classList.remove('hidden');
      mountGame(parts[1]);
    } else {
      game.classList.add('hidden');
      home.classList.remove('hidden');
      window.scrollTo(0, 0);
    }
  };

  function mountGame(name) {
    const def = JPQ.games[name];
    const stage = U.$('#stage');
    if (JPQ.current && JPQ.current.unmount) JPQ.current.unmount();
    stage.innerHTML = '';
    hud.set(def.title, def.sub || '');
    hud.progress(0);
    hud.pills([]);
    JPQ.current = def;
    def.mount(stage);
    window.scrollTo(0, 0);
  }
  JPQ.mountGame = mountGame;

  /* 每次切換遊戲時清掉按鍵監聽，避免重複觸發 */
  JPQ.onKey = function (handler) {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  };

})(window);
