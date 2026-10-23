/* Click-to-read for the particle and verb pages. Audio comes from Google Translate. */
(function (global) {
  'use strict';
  const JPQ = global.JPQ = global.JPQ || {};
  const bound = new WeakSet();
  let active = null;

  function reading(value) {
    return String(value == null ? '' : value)
      .replace(/([一-龯々〆〇0-9]+)\[([^\]]+)\]/g, '$2')
      .replace(/__+/g, '、').replace(/\s+/g, ' ').trim();
  }

  function status(text, state) {
    let node = document.getElementById('ttsStatus');
    if (!node) {
      node = document.createElement('div');
      node.id = 'ttsStatus';
      node.className = 'tts-status';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.appendChild(node);
    }
    node.dataset.state = state;
    node.textContent = text;
  }

  function mark(trigger, on) {
    if (!trigger) return;
    trigger.classList.toggle('is-speaking', on);
    if (on) trigger.setAttribute('aria-busy', 'true');
    else trigger.removeAttribute('aria-busy');
  }

  function release(ctx) {
    clearTimeout(ctx.timer);
    ctx.timer = null;
    if (ctx.cleanup) { ctx.cleanup(); ctx.cleanup = null; }
    if (ctx.audio) {
      try { ctx.audio.pause(); ctx.audio.removeAttribute('src'); ctx.audio.load(); } catch (e) { /* Already detached. */ }
      ctx.audio = null;
    }
    mark(ctx.trigger, false);
  }

  function stop() {
    if (active) {
      const previous = active;
      active = null;
      release(previous);
      previous.resolve(false);
    }
    const node = document.getElementById('ttsStatus');
    if (node) { node.textContent = ''; node.dataset.state = 'idle'; }
  }

  function urlFor(text, lang) {
    const hostedStatic = location.protocol === 'file:' || location.hostname === 'nihongo-2-static.onrender.com' ||
      /\.github\.io$/.test(location.hostname);
    const url = new URL(hostedStatic ? 'https://nihongo-2.onrender.com/api/tts' : '/api/tts', location.href);
    url.searchParams.set('lang', lang);
    url.searchParams.set('text', text);
    return url.href;
  }

  function say(value, options) {
    options = options || {};
    stop();
    if (JPQ.sfx && JPQ.sfx.on === false) {
      status('聲音已關閉，可從右上角開啟。', 'muted');
      return Promise.resolve(false);
    }
    let text = reading(value);
    if (options.particle) text = ({ 'は':'わ', 'へ':'え', 'を':'お' })[text] || text;
    if (!text || !/[\p{L}\p{N}]/u.test(text)) return Promise.resolve(false);
    if (Array.from(text).length > 200) {
      status('這段文字較長，請分段點選朗讀。', 'error');
      return Promise.resolve(false);
    }
    const lang = options.lang === 'zh-TW' ? 'zh-TW' : 'ja';
    return new Promise(resolve => {
      const ctx = { trigger: options.trigger, audio: null, timer: null, cleanup: null, resolve };
      active = ctx;
      function play() {
        if (active !== ctx) return;
        release(ctx);
        status('語音載入中…', 'loading');
        let audio;
        try {
          // The website's API retrieves Google audio; browser media headers are not sent to Google.
          audio = new global.Audio(urlFor(text, lang));
          audio.preload = 'auto';
          audio.playbackRate = 0.9;
        } catch (e) { ctx.failure = e.name || 'AudioUnavailable'; fail(); return; }
        ctx.audio = audio;
        const current = () => active === ctx && ctx.audio === audio;
        function fail() {
          if (active !== ctx) return;
          active = null;
          release(ctx);
          console.warn('Google TTS playback failed:', ctx.failure || 'MediaError');
          status('語音暫時無法播放，請再點一次重試。', 'error');
          resolve(false);
        }
        const playing = () => {
          if (!current()) return;
          clearTimeout(ctx.timer); ctx.timer = null;
          mark(ctx.trigger, true);
          status('正在朗讀…', 'playing');
          resolve(true);
        };
        const ended = () => {
          if (!current()) return;
          active = null; release(ctx); status('', 'idle'); resolve(true);
        };
        const error = event => {
          if (!current()) return;
          ctx.failure = audio.error ? 'MediaError ' + audio.error.code + ': ' + audio.error.message
            : (event && event.name) || 'AudioTimeout';
          fail();
        };
        audio.addEventListener('playing', playing);
        audio.addEventListener('ended', ended);
        audio.addEventListener('error', error);
        ctx.cleanup = () => {
          audio.removeEventListener('playing', playing);
          audio.removeEventListener('ended', ended);
          audio.removeEventListener('error', error);
        };
        ctx.timer = setTimeout(error, 30000);
        try {
          const pending = audio.play();
          if (pending && typeof pending.catch === 'function') pending.catch(error);
        } catch (e) { error(); }
      }
      play();
    });
  }

  function control(text, label, options) {
    const esc = JPQ.util.escapeHTML;
    options = options || {};
    label = label || '聽題目';
    return `<button type="button" class="tts-play" data-tts-text="${esc(text)}" data-tts-lang="${options.lang === 'zh-TW' ? 'zh-TW' : 'ja'}" data-tts-particle="${options.particle ? 'true' : 'false'}" title="Google 朗讀" aria-label="${esc(label)}"><span aria-hidden="true">🔊</span><span>${esc(label)}</span></button>`;
  }

  function bind(root) {
    root.querySelectorAll('[data-tts-text]').forEach(button => {
      if (bound.has(button)) return;
      bound.add(button);
      button.addEventListener('click', () => {
        say(button.dataset.ttsText, {
          lang: button.dataset.ttsLang,
          particle: button.dataset.ttsParticle === 'true',
          trigger: button
        });
      });
    });
  }

  JPQ.tts = { reading, say, stop, control, bind };
  global.addEventListener('hashchange', stop);
  global.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  document.addEventListener('click', event => {
    if (event.target.closest && event.target.closest('#soundBtn') && JPQ.sfx.on === false) stop();
  });
})(window);
