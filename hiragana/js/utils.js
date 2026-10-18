/* ==========================================================================
   utils.js — 共用工具：DOM、亂數、計時、儲存、Modal、Toast
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- DOM */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /**
   * 建立元素
   * @param {string} tag  標籤（支援 "div.cls#id" 簡寫）
   * @param {Object|Array|Node|string} attrs 屬性；也可直接傳 children（省略 attrs）
   * @param {Array|Node|string} [children]
   */
  function el(tag, attrs, children) {
    // 支援 el(tag, children) 兩參數寫法
    if (attrs !== null && attrs !== undefined &&
        (Array.isArray(attrs) || typeof attrs !== 'object' || attrs instanceof Node)) {
      children = attrs;
      attrs = null;
    }

    var parts = tag.split(/(?=[.#])/);
    var node = document.createElement(parts[0] || 'div');
    for (var i = 1; i < parts.length; i++) {
      if (parts[i][0] === '.') node.classList.add(parts[i].slice(1));
      else if (parts[i][0] === '#') node.id = parts[i].slice(1);
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else node.setAttribute(k, v === true ? '' : v);
      });
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children === null || children === undefined) return;
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number'
        ? document.createTextNode(String(c)) : c);
    });
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* -------------------------------------------------------------- 亂數 */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function sample(arr, n) { return shuffle(arr).slice(0, n); }

  function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* -------------------------------------------------------------- 時間 */
  function fmtTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60), s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' +
           String(d.getDate()).padStart(2, '0');
  }

  /** 建立一個會自動清理的計時器 */
  function createTicker(onTick, interval) {
    var id = setInterval(onTick, interval || 1000);
    return {
      stop: function () { clearInterval(id); id = null; },
      isRunning: function () { return id !== null; }
    };
  }

  /** Delayed game effects belong to one board/question, never its replacement. */
  function createTimerScope() {
    var pending = [];
    var active = true;
    var version = 0;
    function reset() {
      version += 1;
      pending.forEach(function (id) { clearTimeout(id); });
      pending = [];
    }
    return {
      later: function (fn, ms) {
        if (!active) return null;
        var current = version;
        var id = setTimeout(function () {
          pending = pending.filter(function (entry) { return entry !== id; });
          if (active && version === current) fn();
        }, ms);
        pending.push(id);
        return id;
      },
      reset: reset,
      destroy: function () { active = false; reset(); },
      isActive: function () { return active; }
    };
  }

  /* ------------------------------------------------------------- 儲存 */
  var memoryStore = {};
  var Store = {
    get: function (key, fallback) {
      try {
        var raw = global.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback;
      }
    },
    set: function (key, value) {
      memoryStore[key] = value;
      try { global.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 私密模式忽略 */ }
      return value;
    }
  };

  /* 注意：本專案刻意不保存任何分數紀錄，
     Store 僅用於保存關卡解鎖等「遊玩進度」。 */

  /* -------------------------------------------------------------- Modal */
  var openModals = [];

  /**
   * @param {Object} o {emoji,title,body(HTML string|Node),stats:[{value,label}],buttons:[{label,variant,close,action}],wide,dismissible}
   * @returns {{close:Function}}
   */
  function modal(o) {
    o = o || {};
    var backdrop = el('div.modal-backdrop');
    var box = el('div.modal' + (o.wide ? '.modal--wide' : ''), { role: 'dialog', 'aria-modal': 'true' });
    var closed = false;
    var focusTimer;

    if (o.emoji) box.appendChild(el('div.modal__emoji', { text: o.emoji }));
    if (o.title) box.appendChild(el('h2.modal__title', { text: o.title }));
    if (o.body) {
      var bodyWrap = el('div.modal__body');
      if (typeof o.body === 'string') bodyWrap.innerHTML = o.body;
      else bodyWrap.appendChild(o.body);
      box.appendChild(bodyWrap);
    }
    if (o.stats && o.stats.length) {
      box.appendChild(el('div.modal__stats', o.stats.map(function (s) {
        return el('div.modal__stat', [el('b', { text: String(s.value) }), el('span', { text: s.label })]);
      })));
    }

    function close(reason) {
      if (closed) return;
      closed = true;
      clearTimeout(focusTimer);
      backdrop.remove();
      openModals = openModals.filter(function (m) { return m !== handle; });
      document.removeEventListener('keydown', onKey);
      if (!openModals.length) document.body.style.overflow = '';
      if (typeof o.onClose === 'function') o.onClose(reason || 'dismiss');
    }

    function onKey(e) {
      if (e.key === 'Escape' && o.dismissible !== false) { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        var f = qsa('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', box)
          .filter(function (n) { return !n.disabled; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    if (o.buttons && o.buttons.length) {
      var actions = el('div.modal__actions', o.buttons.map(function (b) {
        var btn = el('button.btn' + (b.variant ? '.btn--' + b.variant : '') + (b.ghost ? '.btn--ghost' : ''),
          { type: 'button' }, b.label);
        btn.addEventListener('click', function () {
          if (closed) return;
          if (b.close !== false) close('action');
          if (typeof b.action === 'function') setTimeout(function () { b.action(); }, 10);
        });
        return btn;
      }));
      box.appendChild(actions);
    }

    var handle = { close: close, box: box };

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop && o.dismissible !== false) close();
    });
    document.addEventListener('keydown', onKey);
    backdrop.appendChild(box);
    qs('#modalRoot').appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    openModals.push(handle);

    focusTimer = setTimeout(function () {
      if (closed) return;
      var f = qs('.modal .btn', box);
      if (f) f.focus();
    }, 60);
    return handle;
  }

  function closeAllModals() {
    openModals.slice().forEach(function (m) { if (m && m.close) m.close(); });
    var root = qs('#modalRoot');
    if (root) root.innerHTML = '';
    openModals = [];
    document.body.style.overflow = '';
  }

  function confirmModal(o) {
    return new Promise(function (resolve) {
      modal({
        emoji: o.emoji || '🤔',
        title: o.title || '確定嗎？',
        body: o.body || '',
        onClose: function (reason) { if (reason !== 'action') resolve(false); },
        buttons: [
          { label: o.cancelLabel || '取消', variant: 'ghost', action: function () { resolve(false); } },
          { label: o.okLabel || '確定', action: function () { resolve(true); } }
        ]
      });
    });
  }

  /* -------------------------------------------------------------- Toast */
  function toast(message, type, ms) {
    var root = qs('#toastRoot');
    if (!root) return;
    var node = el('div.toast' + (type ? '.toast--' + type : ''), { text: message });
    root.appendChild(node);
    setTimeout(function () {
      node.classList.add('is-out');
      setTimeout(function () { node.remove(); }, 240);
    }, ms || 1800);
  }

  /* ------------------------------------------------------------ 共用 UI */
  function hud(items) {
    return el('div.hud', items.map(function (it) {
      return el('div.hud__item', [
        el('span.hud__label', { text: it.label }),
        el('span.hud__value', { html: escapeHtml(String(it.value)) + (it.unit ? '<small>' + it.unit + '</small>' : '') })
      ]);
    }));
  }

  function hudItem(label, valueEl) {
    return el('div.hud__item', [el('span.hud__label', { text: label }), valueEl]);
  }

  function debounce(fn, wait) {
    var id;
    var debounced = function () {
      var args = arguments, ctx = this;
      clearTimeout(id);
      id = setTimeout(function () { id = null; fn.apply(ctx, args); }, wait);
    };
    debounced.cancel = function () { clearTimeout(id); id = null; };
    return debounced;
  }

  /* ------------------------------------------------------- 開朗鼓勵語音
     完成關卡 / 配對成功 / 答對一題時，依情境隨機挑一句日語鼓勵語，
     慢速播放一次（rate 0.6~0.7）並顯示「日文＋中文」提示。
  ---------------------------------------------------------------------- */
  var praiseHistory = [];

  function praise(tag, opt) {
    opt = opt || {};
    var list = (global.KanaData && global.KanaData.PRAISE) || [];
    var pool = tag ? list.filter(function (p) { return p.tags.indexOf(tag) >= 0; }) : list;
    if (!pool.length) pool = list;
    if (!pool.length) return null;

    // 避免最近用過的句子再被抽中（可用池 > 1 時才需要輪替）
    var fresh = pool.filter(function (p) { return praiseHistory.indexOf(p.ja) < 0; });
    var pick = U_shuffle(fresh.length ? fresh : pool)[0];

    praiseHistory.push(pick.ja);
    if (praiseHistory.length >= (fresh.length ? fresh.length : pool.length)) praiseHistory.shift();

    // 語音只播一次（speak() 內部會先 cancel，不會迴圈）
    if (opt.silent !== true) {
      Speech.speak(pick.ja, { rate: opt.rate || 0.7, volume: 1 });
    }
    if (opt.toast !== false) {
      toast(pick.ja + '　' + pick.zh, 'ok', opt.ms || 2600);
    }
    return pick;
  }

  function U_shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** 捲動到頂端（部分環境不支援 scrollTo 時靜默略過） */
  function scrollTop() {
    try {
      if (typeof global.scrollTo === 'function') global.scrollTo(0, 0);
    } catch (e) { /* 忽略 */ }
  }

  /* ------------------------------------------------------------ 語音 TTS
     使用瀏覽器內建的語音合成，語系固定 ja-JP。
     · 語速刻意放慢（初學者清楚聽每個音），音量固定最大。
     · 不指定任何特定語音名稱，只依語系挑系統預設的日語語音。
     · 環境不支援時所有方法都是安全的 no-op，遊戲照常進行。
  ---------------------------------------------------------------------- */
  var Speech = (function () {
    var synth = global.speechSynthesis || null;
    var voices = [];
    var jaVoice = null;
    var enabled = true;

    function loadVoices() {
      if (!synth) return;
      voices = synth.getVoices() || [];
      // 只用 lang 判斷，不寫死引擎名稱
      jaVoice = voices.filter(function (v) {
        return /^ja(-|_|$)/i.test(v.lang || '');
      })[0] || null;
    }

    if (synth) {
      loadVoices();
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', loadVoices);
      } else {
        synth.onvoiceschanged = loadVoices;
      }
    }

    return {
      /** 環境是否支援語音 */
      supported: function () { return !!synth; },
      /** 是否找得到日語語音（找不到就用系統預設朗讀） */
      hasJaVoice: function () { return !!jaVoice; },
      setEnabled: function (v) { enabled = !!v; },
      isEnabled: function () { return enabled && !!synth; },

      /**
       * 慢速清晰朗讀
       * @param {string} text 日文／平假名
       * @param {Object} [opt] { rate, pitch, volume, onend }
       */
      speak: function (text, opt) {
        opt = opt || {};
        if (!synth || !enabled || !text) return false;
        try {
          if (!jaVoice) loadVoices();
          synth.cancel();
          var u = new global.SpeechSynthesisUtterance(String(text));
          u.lang = 'ja-JP';
          if (jaVoice) u.voice = jaVoice;
          u.rate = opt.rate === undefined ? 0.7 : opt.rate;      // 初學者慢速 0.6~0.7
          u.pitch = opt.pitch === undefined ? 1 : opt.pitch;
          u.volume = opt.volume === undefined ? 1 : opt.volume;  // 最大音量
          if (typeof opt.onend === 'function') u.onend = opt.onend;
          synth.speak(u);
          return true;
        } catch (e) {
          return false;
        }
      },
      stop: function () {
        if (synth) { try { synth.cancel(); } catch (e) { /* ignore */ } }
      }
    };
  })();

  global.App = global.App || {};
  global.App.utils = {
    qs: qs, qsa: qsa, el: el, clear: clear, appendChildren: appendChildren, escapeHtml: escapeHtml,
    shuffle: shuffle, sample: sample, randomInt: randomInt, pick: pick,
    fmtTime: fmtTime, fmtDate: fmtDate, createTicker: createTicker, createTimerScope: createTimerScope,
    Store: Store, scrollTop: scrollTop, praise: praise,
    modal: modal, closeAllModals: closeAllModals, confirmModal: confirmModal, toast: toast,
    Speech: Speech,
    hud: hud, hudItem: hudItem, debounce: debounce
  };
})(window);
