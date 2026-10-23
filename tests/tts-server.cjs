'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { createGoogleTtsService } = require('../server/google-tts.js');

const MP3 = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x00]);
const response = () => new Response(MP3, { headers: { 'Content-Type': 'audio/mpeg' } });
const failure = statusCode => error => error.statusCode === statusCode;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('server obtains encoded Japanese audio from fixed Google providers and returns MP3 bytes', async () => {
  const calls = [];
  const service = createGoogleTtsService({ fetchImpl: async (url, options) => { calls.push({ url: new URL(url), options }); return response(); } });
  const result = await service.synthesize('がっこうへ　いきます。', 'ja');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.protocol, 'https:');
  assert.equal(calls[0].url.hostname, 'translate.google.com');
  assert.equal(calls[0].url.pathname, '/translate_tts');
  assert.equal(calls[0].url.searchParams.get('client'), 'tw-ob');
  assert.equal(calls[0].url.searchParams.get('tl'), 'ja');
  assert.equal(calls[0].url.searchParams.get('q'), 'がっこうへ　いきます。');
  assert.deepEqual(result.audio, MP3);
  assert.equal(result.contentType, 'audio/mpeg');
  assert.equal(result.cached, false);
});

test('invalid text and unsupported languages fail before a provider request', async () => {
  let calls = 0;
  const service = createGoogleTtsService({ fetchImpl: async () => { calls++; return response(); } });
  for (const text of ['', '   ', 'あ'.repeat(201), 'あ\0い', '\nあ', 'あ\n']) {
    await assert.rejects(service.synthesize(text, 'ja'), failure(400), JSON.stringify(text));
  }
  for (const lang of ['', 'en', 'ja-JP', 'https://other.test/']) {
    await assert.rejects(service.synthesize('あ', lang), failure(400), lang);
  }
  assert.equal(calls, 0);
  const boundary = await service.synthesize('あ'.repeat(200), 'ja');
  assert.deepEqual(boundary.audio, MP3);
});

test('HTML responses and audio-labelled HTML fall back once to the other Google provider', async () => {
  for (const contentType of ['text/html', 'audio/mpeg']) {
    const calls = [];
    const service = createGoogleTtsService({ fetchImpl: async url => {
      calls.push(new URL(url));
      return calls.length === 1
        ? new Response('<html>Google error</html>', { headers: { 'Content-Type': contentType } }) : response();
    } });
    const result = await service.synthesize('たべます', 'ja');
    assert.deepEqual(result.audio, MP3);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].hostname, 'translate.google.com');
    assert.equal(calls[1].hostname, 'translate.googleapis.com');
    assert.equal(calls[1].searchParams.get('client'), 'gtx');
    assert.equal(calls[1].searchParams.get('q'), 'たべます');
    assert.equal(calls[1].searchParams.get('tl'), 'ja');
  }
});

test('both failed upstream providers return an error without caching the failure', async () => {
  let calls = 0, healthy = false;
  const service = createGoogleTtsService({ fetchImpl: async () => { calls++; return healthy ? response() : new Response('unavailable', { status: 503 }); } });
  await assert.rejects(service.synthesize('のみます', 'ja'), failure(502));
  assert.equal(calls, 2, 'A failing provider must not create an unlimited retry loop');
  healthy = true;
  const result = await service.synthesize('のみます', 'ja');
  assert.deepEqual(result.audio, MP3);
  assert.equal(result.cached, false);
  assert.equal(calls, 3);
});

test('identical in-flight speech is coalesced; later requests hit cache; language remains part of its key', async () => {
  let release, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const service = createGoogleTtsService({ fetchImpl: async () => { calls++; if (calls === 1) await gate; return response(); } });
  const first = service.synthesize('は', 'ja');
  const second = service.synthesize('は', 'ja');
  await flush(); assert.equal(calls, 1);
  release();
  const results = await Promise.all([first, second]);
  results.forEach(result => assert.deepEqual(result.audio, MP3));
  const cached = await service.synthesize('は', 'ja');
  assert.equal(cached.cached, true); assert.equal(calls, 1);
  await service.synthesize('は', 'zh-TW'); assert.equal(calls, 2);
});

test('expired cached audio is fetched again and an LRU bound evicts the least recently used key', async () => {
  let calls = 0;
  const shortCache = createGoogleTtsService({ ttlMs: 15, fetchImpl: async () => { calls++; return response(); } });
  await shortCache.synthesize('ねます', 'ja');
  assert.equal((await shortCache.synthesize('ねます', 'ja')).cached, true);
  await sleep(35);
  assert.equal((await shortCache.synthesize('ねます', 'ja')).cached, false);
  assert.equal(calls, 2);
  calls = 0;
  const bounded = createGoogleTtsService({ maxCacheEntries: 2, fetchImpl: async () => { calls++; return response(); } });
  await bounded.synthesize('あ', 'ja'); await bounded.synthesize('い', 'ja');
  assert.equal((await bounded.synthesize('あ', 'ja')).cached, true);
  await bounded.synthesize('う', 'ja');
  assert.equal((await bounded.synthesize('あ', 'ja')).cached, true, 'A recent hit must survive eviction');
  assert.equal((await bounded.synthesize('い', 'ja')).cached, false, 'The least recently used key must be evicted');
  assert.equal(calls, 4);
});

test('the concurrency cap rejects extra unique work but permits coalesced requests and recovers afterward', async () => {
  let release, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const service = createGoogleTtsService({ maxConcurrency: 1, fetchImpl: async () => { calls++; if (calls === 1) await gate; return response(); } });
  const first = service.synthesize('いきます', 'ja');
  const same = service.synthesize('いきます', 'ja');
  await flush(); assert.equal(calls, 1);
  await assert.rejects(service.synthesize('きます', 'ja'), failure(429));
  assert.equal(calls, 1);
  release(); await Promise.all([first, same]);
  assert.deepEqual((await service.synthesize('きます', 'ja')).audio, MP3);
  assert.equal(calls, 2);
});

test('both provider timeouts abort requests, do not cache failure, and release the concurrency slot', async () => {
  let calls = 0, aborted = 0, healthy = false;
  const service = createGoogleTtsService({ timeoutMs: 10, maxConcurrency: 1, fetchImpl: async (url, options) => {
    calls++;
    if (healthy) return response();
    return new Promise((resolve, reject) => {
      const fail = () => { aborted++; reject(new DOMException('timed out', 'AbortError')); };
      if (options.signal.aborted) fail(); else options.signal.addEventListener('abort', fail, { once: true });
    });
  } });
  await assert.rejects(service.synthesize('かえります', 'ja'), failure(502));
  assert.equal(calls, 2); assert.equal(aborted, 2);
  healthy = true;
  const result = await service.synthesize('かえります', 'ja');
  assert.equal(result.cached, false); assert.deepEqual(result.audio, MP3);
});
