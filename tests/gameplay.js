'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Small DOM and clock for exercising the real game event handlers without dependencies.
function harness(files) {
  const listeners = new Map(), timers = new Map();
  let nextTimer = 0;
  class Element {
    constructor(tag = 'div', attrs = '') {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.dataset = {};
      this.style = {};
      this.events = {};
      this.attributes = {};
      this.disabled = false;
      for (const m of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
        this.attributes[m[1]] = m[2] || '';
        if (m[1].startsWith('data-')) this.dataset[m[1].slice(5)] = m[2];
      }
      this.id = this.attributes.id;
      const classes = new Set((this.attributes.class || '').split(/\s+/));
      this.classList = {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        contains: n => classes.has(n),
        toggle(n, on = !classes.has(n)) { if (on) classes.add(n); else classes.delete(n); }
      };
    }
    set innerHTML(html) {
      this.html = html;
      this.children = [];
      const stack = [this];
      for (const m of html.matchAll(/<\/?([\w-]+)([^>]*)>/g)) {
        if (m[0].startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
        const el = new Element(m[1], m[2]);
        stack.at(-1).children.push(el);
        if (!['input', 'br', 'hr', 'img', 'meta', 'link'].includes(m[1])) stack.push(el);
      }
    }
    get innerHTML() { return this.html || ''; }
    querySelectorAll(selector) {
      const last = selector.trim().split(/\s+/).at(-1);
      const matches = el => {
        const id = last.match(/#([\w-]+)/);
        if (id && el.id !== id[1]) return false;
        if ([...last.matchAll(/\.([\w-]+)/g)].some(m => !el.classList.contains(m[1]))) return false;
        for (const m of last.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
          if (!(m[1] in el.attributes) || (m[2] !== undefined && el.attributes[m[1]] !== m[2])) return false;
        }
        return true;
      };
      return this.children.flatMap(el => (matches(el) ? [el] : []).concat(el.querySelectorAll(selector)));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    click() { if (!this.disabled) (this.events.click || []).forEach(fn => fn({target: this})); }
    focus() {}
    insertAdjacentHTML(position, html) { const holder = new Element(); holder.innerHTML = html; stage.children.push(...holder.children); }
  }
  const doc = new Element();
  doc.innerHTML = '<div id="view-home"></div><div id="view-game"></div><div id="modal" class="hidden"></div><div id="stage"></div>';
  doc.addEventListener = (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); };
  doc.removeEventListener = (type, fn) => listeners.get(type)?.delete(fn);
  const stage = doc.querySelector('#stage');
  const schedule = (fn, interval) => { const id = ++nextTimer; timers.set(id, {fn, interval}); return id; };
  const sandbox = {
    document: doc, location: { hash: '#/' }, scrollTo() {}, addEventListener() {}, console,
    localStorage: {getItem() {return null;}, setItem() {}}, AbortController,
    setTimeout: fn => schedule(fn, false), clearTimeout: id => timers.delete(id),
    setInterval: fn => schedule(fn, true), clearInterval: id => timers.delete(id)
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  ['core.js', ...files].forEach(file => new vm.Script(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), {filename:file}).runInContext(context));
  const J = context.JPQ;
  const runs = [], answers = [];
  Object.assign(J.hud, {set() {}, progress() {}, pills() {}, clearPills() {}});
  J.sfx = new Proxy({}, {get: () => () => {}});
  J.fx = {center() {}, burst() {}};
  J.speech = {say() {}, stop() {}, init() {}, available() { return false; }};
  J.stats.run = (...args) => runs.push(args);
  J.stats.answer = (...args) => answers.push(args);
  let modal;
  J.modal = {show(opts) {modal = opts;}, close() {modal = null;}};
  return {J, stage, runs, answers, timers, doc,
    setFetch(fn) {sandbox.fetch = fn;},
    modal: () => modal,
    load(file) { new vm.Script(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8')).runInContext(context); },
    key(key, target = stage, extra = {}) {
      const e = {key, target, preventDefault() {this.prevented = true;}, ...extra};
      [...(listeners.get('keydown') || [])].forEach(fn => fn(e));
      return e;
    },
    tick() { [...timers].filter(([, t]) => t.interval).forEach(([id,t]) => {if (timers.has(id)) t.fn();}); },
    flush() { [...timers].filter(([, t]) => !t.interval).forEach(([id,t]) => {if (timers.delete(id)) t.fn();}); },
    route(hash) {sandbox.location.hash = hash; J.router();}
  };
}

function lifecycle() {
  const h = harness(['data.js', 'speed.js']);
  h.route('#/play/speed'); h.stage.querySelector('#startBtn').click();
  assert.equal(h.timers.size, 1);
  h.stage.querySelector('.opt').click();
  h.route('#/');
  assert.equal(h.J.current, null);
  assert.equal(h.timers.size, 0, 'Leaving a game must cancel countdowns and delayed draws');
  h.flush(); h.tick();
  assert.equal(h.runs.length, 0, 'Leaving early must not record a completed speed round');

  let hits = 0;
  const off = h.J.onKey(() => hits++);
  h.key('1', {tagName:'INPUT'});
  h.key('1', h.stage, {repeat:true});
  h.doc.querySelector('#modal').classList.remove('hidden'); h.key('1');
  h.doc.querySelector('#modal').classList.add('hidden'); h.key('1');
  assert.equal(hits, 1, 'Game shortcuts must ignore text fields, held keys, and dialogs');
  off(); h.key('1'); assert.equal(hits, 1);
  h.J.store.setLevelStars(1, 2);
  h.J.store.setLevelStars('verb-study-v2-1', 3);
  h.J.store.setLevelStars('verb-1', 3);
  assert.equal(h.J.store.totalStars(), 2, 'Particle stars must not include current or legacy verb progress');
}

function matching() {
  const h = harness(['data.js', 'match.js']);
  h.route('#/play/match'); h.stage.querySelector('#startBtn').click();
  const pair = key => {
    h.stage.querySelector(`.mtile[data-side="L"][data-k="${key}"]`).click();
    h.stage.querySelector(`.mtile[data-side="R"][data-k="${key}"]`).click();
  };
  const keys = Array.from(h.J.MATCH[0].pairs, p => p.k);
  keys.slice(0, 3).forEach(pair);
  for (let n = 0; n < 75; n++) h.tick();
  assert.equal(h.modal().title, '第 1 回合完成');
  pair(keys[3]);
  h.modal().actions[0].onClick();
  keys.slice(0, 5).forEach(pair);
  assert.equal(h.modal(), null, 'The second round must not end at eight cumulative matches');
  keys.slice(5).forEach(pair);
  assert.equal(h.modal().title, '第 2 回合完成');
  h.modal().actions[0].onClick(); keys.forEach(pair);
  assert.equal(h.modal().title, '配對完成！');
  assert.match(h.modal().html, /未完成<b>5<\/b>/);
  assert(!h.modal().html.includes('零失誤'), 'Timed-out pairs must prevent a perfect rating');
  assert.deepEqual(h.runs[0], ['match', 24, 19]);
}

function kana() {
  const h = harness(['kana-data.js', 'vocab-data.js']); h.load('gojuon.js');
  h.route('#/play/kana-read');
  h.stage.querySelector('[data-pool="vocabulary"]').click();
  h.stage.querySelector('[data-round="0"]').click();
  const seen = new Set();
  for (let n = 0; n < 16; n++) {
    const word = h.stage.innerHTML.match(/class="kana-big [^"]*">([^<]+)/)[1];
    assert(!seen.has(word), 'All-questions mode must cover each word once'); seen.add(word);
    h.stage.querySelector('.opt').click(); h.stage.querySelector('#nextBtn').click();
  }
  assert.equal(seen.size, 16); assert.equal(h.runs.length, 1);
  h.stage.querySelector('#againBtn').click();
  h.stage.querySelector('.opt').click();
  h.stage.querySelector('[data-pool="hiragana"]').click();
  assert.equal(h.runs.length, 2, 'Changing settings must save the previous answered questions');
  h.route('#/'); assert.equal(h.runs.length, 2, 'Leaving must not count an empty new round');

  h.route('#/play/kana-match');
  const letters = h.J.kanaPool.hiragana.items;
  // Match using the visible text of each pair, as a player would.
  const left = h.stage.querySelectorAll('.mtile[data-side="L"]');
  const right = h.stage.querySelectorAll('.mtile[data-side="R"]');
  const html = h.stage.innerHTML;
  const tiles = Array.from(html.matchAll(/data-side="([LR])" data-i="(\d+)"[^>]*><span class="ptext">([^<]+)/g));
  for (const l of tiles.filter(t => t[1] === 'L')) {
    const roman = letters.find(it => it.char === l[3]).roman;
    const r = tiles.find(t => t[1] === 'R' && t[3] === roman);
    left[Number(l[2])].click(); right[Number(r[2])].click();
  }
  assert(h.timers.size > 0);
  h.route('#/');
  const before = h.stage.innerHTML; h.flush();
  assert.equal(h.stage.innerHTML, before, 'A delayed match result must not repaint after leaving');
}

function scramble() {
  const h = harness(['data.js', 'scramble.js']);
  h.route('#/play/scramble'); h.stage.querySelector('#startBtn').click();
  const q = h.J.SCRAMBLE[0];
  q.ans.forEach((_, i) => h.stage.querySelector(`#pool`).querySelector(`[data-pool="${i}"]`).click());
  const key = h.key('Enter'); assert(key.prevented);
  const count = h.answers.length;
  h.key('Enter'); h.key('Enter');
  assert.equal(h.answers.length, count, 'A solved sentence cannot be scored twice');
  assert.equal(h.stage.querySelectorAll('#nextBtn').length, 1);
  assert.deepEqual(h.answers.map(a => a[0]), ['は', 'が'], 'Only actual particles count toward particle accuracy');
  assert.deepEqual(Array.from(h.J.SCRAMBLE[17].particles), ['に', 'を'], 'このこと must not be counted as particle と');
  assert.deepEqual(Array.from(h.J.SCRAMBLE[19].particles), ['が'], 'でんしゃ must not be counted as particle で');
}

async function leaderboard() {
  const h = harness([]); h.load('leaderboard.js');
  let attempts = 0;
  h.setFetch(async () => {throw new Error('Temporarily offline');});
  assert.equal(await h.J.lb.refresh(), false);
  h.setFetch(async () => {attempts++; return {ok:true, json:async () => ({ok:true, boards:{}})};});
  const result = await h.J.lb.submit('speed', 'Test', 10, '');
  assert(result.ok); assert.equal(h.J.lb.ok, true); assert.equal(attempts, 1,
    'An initial connection failure must not permanently disable score submissions');
  assert.equal(h.timers.size, 0, 'Successful requests must clean up their timeout');
  h.setFetch((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('Request timed out')));
  }));
  const pending = h.J.lb.request({}); h.flush();
  await assert.rejects(pending, /timed out/);
  assert.equal(h.timers.size, 0);
}

(async () => {
  lifecycle(); matching(); kana(); scramble(); await leaderboard();
  console.log('Gameplay regression tests passed.');
})().catch(err => { console.error(err); process.exitCode = 1; });
