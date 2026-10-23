'use strict';

const MAX_TEXT_LENGTH = 200;
const MAX_AUDIO_BYTES = 512 * 1024;
const ALLOWED_LANGUAGES = new Set(['ja', 'zh-TW']);

function serviceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isMp3(audio) {
  return audio.length >= 3 && (
    audio.subarray(0, 3).toString('ascii') === 'ID3' ||
    (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0)
  );
}

async function cancelBody(response) {
  try { await response.body?.cancel(); } catch (_) { /* Already consumed or aborted. */ }
}

async function readAudio(response) {
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const declaredSize = Number(response.headers.get('content-length'));
  if (!response.ok || contentType !== 'audio/mpeg' || declaredSize > MAX_AUDIO_BYTES) {
    await cancelBody(response);
    throw serviceError(502, '語音服務暫時無法使用，請稍後重試。');
  }

  let audio;
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_AUDIO_BYTES) {
          await reader.cancel();
          throw serviceError(502, '語音服務暫時無法使用，請稍後重試。');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    audio = Buffer.concat(chunks, size);
  } else {
    audio = Buffer.from(await response.arrayBuffer());
  }
  if (audio.length > MAX_AUDIO_BYTES || !isMp3(audio)) {
    throw serviceError(502, '語音服務暫時無法使用，請稍後重試。');
  }
  return audio;
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function createGoogleTtsService({
  fetchImpl = global.fetch,
  maxCacheEntries = 200,
  maxConcurrency = 4,
  ttlMs = 86400000,
  timeoutMs = 8000
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  maxCacheEntries = positiveInteger(maxCacheEntries, 200);
  maxConcurrency = positiveInteger(maxConcurrency, 4);
  ttlMs = positiveInteger(ttlMs, 86400000);
  timeoutMs = positiveInteger(timeoutMs, 8000);

  const cache = new Map();
  const inFlight = new Map();
  let activeRequests = 0;

  async function requestAudio(url) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(serviceError(502, '語音服務暫時無法使用，請稍後重試。'));
      }, timeoutMs);
    });
    try {
      return await Promise.race([
        Promise.resolve().then(() => fetchImpl(url, { signal: controller.signal })).then(readAudio),
        timeout
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function synthesize(text, lang = 'ja') {
    if (typeof text !== 'string' || /\p{Cc}/u.test(text) || !ALLOWED_LANGUAGES.has(lang)) {
      throw serviceError(400, '請提供有效的朗讀文字與語言。');
    }
    const normalizedText = text.trim();
    const characterCount = [...normalizedText].length;
    if (characterCount < 1 || characterCount > MAX_TEXT_LENGTH) {
      throw serviceError(400, '朗讀文字需為 1 至 200 字。');
    }
    const key = lang + '\0' + normalizedText;
    const saved = cache.get(key);
    if (saved && saved.expiresAt > Date.now()) {
      cache.delete(key);
      cache.set(key, saved);
      return { audio: saved.audio, contentType: 'audio/mpeg', cached: true };
    }
    if (saved) cache.delete(key);
    if (inFlight.has(key)) return inFlight.get(key);
    if (activeRequests >= maxConcurrency) {
      throw serviceError(429, '目前朗讀人數較多，請稍後重試。');
    }

    activeRequests += 1;
    const task = (async () => {
      const providers = [
        ['https://translate.google.com/translate_tts', 'tw-ob'],
        ['https://translate.googleapis.com/translate_tts', 'gtx']
      ];
      for (const [endpoint, client] of providers) {
        const url = new URL(endpoint);
        url.searchParams.set('ie', 'UTF-8');
        url.searchParams.set('tl', lang);
        url.searchParams.set('client', client);
        url.searchParams.set('q', normalizedText);
        try {
          const audio = await requestAudio(url.href);
          cache.set(key, { audio, expiresAt: Date.now() + ttlMs });
          while (cache.size > maxCacheEntries) cache.delete(cache.keys().next().value);
          return { audio, contentType: 'audio/mpeg', cached: false };
        } catch (_) {
          // Retry only the second fixed Google endpoint; never fetch a caller-provided URL.
        }
      }
      throw serviceError(502, '語音服務暫時無法使用，請稍後重試。');
    })().finally(() => {
      activeRequests -= 1;
      inFlight.delete(key);
    });
    inFlight.set(key, task);
    return task;
  }

  return { synthesize };
}

module.exports = { createGoogleTtsService };
