/* =========================================================
   遊戲學日語 — 本機 / 區域網路伺服器
   用法：node server.js [埠號]   預設 8000
   含排行榜 API：GET /api/leaderboard、POST /api/leaderboard
   ========================================================= */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8000;

/* 排行榜資料夾：在 Render / Railway 這類平台可以掛一個持久磁碟，
   把 DATA_DIR 指到掛載路徑（例如 /var/data），成績就不會被重啟清掉 */
function envPath(name, fallback) {
  const v = String(process.env[name] || '').trim();
  return v ? path.resolve(v) : fallback;
}
const DATA_DIR = envPath('DATA_DIR', path.join(ROOT, 'data'));
const DB_FILE = envPath('DB_FILE', path.join(DATA_DIR, 'leaderboard.json'));

/* ---- 排行榜儲存位置 ----
   1. 有設定 Upstash Redis → 成績存在雲端資料庫，重啟也不會不見（免費額度就夠）
   2. 沒有 → 用本機的 JSON 檔案。雲端平台的磁碟是暫存的，重啟會清空。 */
const UPSTASH_URL = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/+$/, '');
const UPSTASH_TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
const USE_REDIS = !!(UPSTASH_URL && UPSTASH_TOKEN);

/* 判斷是不是跑在雲端平台的暫存磁碟上。
   這裡沒有 DATA_DIR 又跑在 Render / Railway / Fly 上，磁碟就是暫存的，
   重啟後成績會不見 → 前端要主動告訴玩家，不要讓人以為成績還在。
   有用 Redis 的話就已經不依賴磁碟了，不算暫存。 */
const ON_CLOUD = !!(process.env.RENDER || process.env.RAILWAY_ENVIRONMENT ||
                    process.env.FLY_APP_NAME || process.env.DYNO);
const EPHEMERAL = String(process.env.EPHEMERAL || '').trim().toLowerCase() === 'true' ||
                  (ON_CLOUD && !process.env.DATA_DIR && !USE_REDIS);

const MAX_PER_GAME = 30;          /* 每種遊戲最多留幾筆 */
const MAX_TOTAL = 400;            /* 全部最多幾筆 */
const NAME_MAX = 16;              /* 暱稱最長幾字 */
const ALLOWED_GAMES = new Set([
  'quiz', 'speed', 'scramble', 'match',
  'kana-order', 'kana-convert', 'kana-listen'
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

/* =========================================================
   排行榜儲存層
   readAll() → { entries: [{name, game, score, detail, at}] }
   submit()  → { bestOld, entries }
   ========================================================= */
let cache = null;        /* 檔案模式下的 { entries: [...] } */
let writing = Promise.resolve();

function emptyDB() { return { entries: [], updatedAt: 0 }; }

/* ---------- 檔案模式 ---------- */
function fileReadAll() {
  if (cache) return cache;
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    cache = (data && Array.isArray(data.entries)) ? data : emptyDB();
  } catch (e) {
    cache = emptyDB();
  }
  return cache;
}

let lastWriteOk = true;
let lastWriteError = '';

function saveDB(db) {
  writing = writing.then(() => new Promise(resolve => {
    fs.mkdir(DATA_DIR, { recursive: true }, () => {
      const tmp = DB_FILE + '.tmp';
      fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8', (err) => {
        if (err) { lastWriteOk = false; lastWriteError = err.message; return resolve(); }
        fs.rename(tmp, DB_FILE, (err2) => {
          if (err2) { lastWriteOk = false; lastWriteError = err2.message; }
          else { lastWriteOk = true; lastWriteError = ''; }
          resolve();
        });
      });
    });
  }));
  return writing;
}

/* ---------- Redis 模式（Upstash REST API，不需要任何 npm 套件） ---------- */
/* 用 Redis sorted set 存分數，member 就是暱稱。
   ZADD GT 只在新分數比較高時才更新 → 「同名保留最高分」變成一個原子指令，
   不會有兩個人同時登記就互相覆蓋的問題。 */
function redisPipe(cmds) {
  return fetch(UPSTASH_URL + '/pipeline', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + UPSTASH_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cmds)
  }).then(r => {
    if (!r.ok) throw new Error('Redis HTTP ' + r.status);
    return r.json();
  });
}

const rk = g => 'jpq:z:' + g;          /* 分數 */
const mk = g => 'jpq:m:' + g;          /* 詳情 */
const GAMES_KEY = 'jpq:games';         /* 有資料的遊戲 */

async function redisReadAll() {
  const first = await redisPipe([['SMEMBERS', GAMES_KEY]]);
  if (first[0] && first[0].error) throw new Error(first[0].error);
  const games = first[0] && first[0].result ? first[0].result : [];
  if (!games.length) return { entries: [], updatedAt: 0 };

  const cmds = [];
  games.forEach(g => {
    cmds.push(['ZRANGE', rk(g), '0', String(MAX_PER_GAME - 1), 'REV', 'WITHSCORES']);
    cmds.push(['HGETALL', mk(g)]);
  });
  const res = await redisPipe(cmds);

  const entries = [];
  games.forEach((g, i) => {
    const flat = (res[i * 2] && res[i * 2].result) || [];
    const metaRaw = (res[i * 2 + 1] && res[i * 2 + 1].result) || [];
    /* HGETQL 回傳 [欄位, 值, 欄位, 值, ...]，轉成查表用的物件 */
    const meta = {};
    if (Array.isArray(metaRaw)) {
      for (let j = 0; j < metaRaw.length; j += 2) meta[metaRaw[j]] = metaRaw[j + 1];
    }
    for (let j = 0; j < flat.length; j += 2) {
      const name = flat[j];
      let m = {};
      try { m = JSON.parse(meta[name] || '{}'); } catch (e) { m = {}; }
      entries.push({
        name: name, game: g,
        score: Number(flat[j + 1]),
        detail: m.d || '', at: m.t || 0
      });
    }
  });
  return { entries, updatedAt: 0 };
}

const REDIS_SUBMIT_SCRIPT = `
local old = redis.call('ZSCORE', KEYS[1], ARGV[1])
if (not old) or (tonumber(ARGV[2]) > tonumber(old)) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
  redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
end
redis.call('SADD', KEYS[3], ARGV[4])
local dropped = redis.call('ZRANGE', KEYS[1], 0, tonumber(ARGV[5]))
for _, member in ipairs(dropped) do
  redis.call('ZREM', KEYS[1], member)
  redis.call('HDEL', KEYS[2], member)
end
return old
`;

async function redisSubmit(game, name, score, detail) {
  /* 分數與詳情必須一起更新，避免低分覆蓋高分的詳情。 */
  const result = await redisPipe([[
    'EVAL', REDIS_SUBMIT_SCRIPT, '3', rk(game), mk(game), GAMES_KEY,
    name, String(score), JSON.stringify({ d: detail || '', t: Date.now() }),
    game, String(-(MAX_PER_GAME + 1))
  ]]);
  const raw = result[0] && result[0].result;
  const bestOld = (raw === null || raw === undefined) ? -1 : Number(raw);
  return bestOld;
}

/* ---------- 依設定選用哪一種 ---------- */
const store = USE_REDIS ? {
  kind: 'redis',
  readAll: redisReadAll,
  submit: async (game, name, score, detail) => {
    const bestOld = await redisSubmit(game, name, score, detail);
    lastWriteOk = true; lastWriteError = '';
    return { bestOld, db: await redisReadAll() };
  }
} : {
  kind: 'file',
  readAll: async () => fileReadAll(),
  submit: async (game, name, score, detail) => {
    const db = fileReadAll();
    /* 同一個暱稱在同一個遊戲只保留最高分 */
    const prev = db.entries.find(e => e.game === game && e.name === name);
    const bestOld = prev ? prev.score : -1;
    if (!prev || score > prev.score) {
      db.entries = db.entries.filter(e => !(e.game === game && e.name === name));
      db.entries.push({ name, game, score, detail, at: Date.now() });
    }
    /* 每一種只留前 MAX_PER_GAME 名 */
    const games = [...new Set(db.entries.map(e => e.game))];
    games.forEach(g => {
      const list = db.entries.filter(e => e.game === g).sort((a, b) => b.score - a.score || a.at - b.at);
      const keep = new Set(list.slice(0, MAX_PER_GAME));
      db.entries = db.entries.filter(e => !(e.game === g && !keep.has(e)));
    });
    if (db.entries.length > MAX_TOTAL) {
      db.entries = db.entries.slice().sort((a, b) => b.at - a.at).slice(0, MAX_TOTAL);
    }
    db.updatedAt = Date.now();
    await saveDB(db);
    return { bestOld, db };
  }
};

function cleanText(s, max) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u001f\u007f]/g, '')   /* 控制字元 */
    .replace(/[<>&"'\\]/g, '')             /* 避免注入 */
    .trim()
    .slice(0, max);
}

function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function rankOf(entries, game) {
  const list = entries
    .filter(e => e.game === game)
    .sort((a, b) => b.score - a.score || a.at - b.at);
  return list.map((e, i) => ({ rank: i + 1, name: e.name, score: e.score, detail: e.detail || '', at: e.at }));
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

async function handleAPI(req, res, urlPath) {
  /* ---- GET /api/health（平台健康檢查用） ---- */
  if (req.method === 'GET' && urlPath === '/api/health') {
    let writable = false;
    if (USE_REDIS) {
      writable = true;
    } else {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.accessSync(DATA_DIR, fs.constants.W_OK);
        writable = true;
      } catch (e) { writable = false; }
    }

    let entries = 0;
    try { entries = (await store.readAll()).entries.length; } catch (e) { entries = -1; }

    sendJSON(res, 200, {
      ok: true,
      service: 'nihongo-2',
      port: PORT,
      storage: USE_REDIS
        ? { kind: 'redis', persistent: true }
        : { kind: 'file', dir: DATA_DIR, file: DB_FILE, writable: writable },
      leaderboardPersistent: USE_REDIS || (writable && !EPHEMERAL),
      ephemeral: EPHEMERAL,
      onCloud: ON_CLOUD,
      entries: entries,
      uptimeSec: Math.round(process.uptime())
    });
    return;
  }

  /* ---- GET /api/leaderboard ---- */
  if (req.method === 'GET' && urlPath === '/api/leaderboard') {
    let db;
    try {
      db = await store.readAll();
    } catch (e) {
      sendJSON(res, 503, { ok: false, error: '排行榜暫時無法讀取：' + e.message });
      return;
    }
    const games = {};
    db.entries.forEach(e => { games[e.game] = true; });
    sendJSON(res, 200, {
      ok: true,
      persistent: (lastWriteOk || USE_REDIS) && !EPHEMERAL,
      ephemeral: EPHEMERAL,
      note: lastWriteOk ? '' : ('儲存失敗：' + lastWriteError),
      updatedAt: db.updatedAt || 0,
      boards: Object.keys(games).reduce((acc, g) => { acc[g] = rankOf(db.entries, g); return acc; }, {}),
      total: db.entries.length
    });
    return;
  }

  /* ---- POST /api/leaderboard ---- */
  if (req.method === 'POST' && urlPath === '/api/leaderboard') {
    let body = '';
    let tooBig = false;
    req.on('data', c => {
      if (tooBig) return;
      body += c;
      if (body.length > 4000) { tooBig = true; body = ''; }
    });
    req.on('end', () => {
      if (tooBig) { sendJSON(res, 413, { ok: false, error: '資料太大' }); return; }
      let data;
      try { data = JSON.parse(body || '{}'); }
      catch (e) { sendJSON(res, 400, { ok: false, error: '格式錯誤' }); return; }

      const game = cleanText(data.game, 24);
      const name = cleanText(data.name, NAME_MAX);
      const score = Math.floor(Number(data.score));
      const detail = cleanText(data.detail, 40);

      if (!game || !name) { sendJSON(res, 400, { ok: false, error: '需要遊戲名稱與暱稱' }); return; }
      if (!ALLOWED_GAMES.has(game)) { sendJSON(res, 400, { ok: false, error: '不支援這個遊戲' }); return; }
      if (!isFinite(score) || score < 0 || score > 1000000) {
        sendJSON(res, 400, { ok: false, error: '成績格式錯誤' }); return;
      }

      store.submit(game, name, score, detail).then(({ bestOld, db }) => {
        const board = rankOf(db.entries, game);
        const mine = board.find(e => e.name === name);
        const games = [...new Set(db.entries.map(e => e.game))];
        sendJSON(res, 200, {
          ok: true,
          saved: lastWriteOk,
          savedNote: lastWriteOk ? '' : lastWriteError,
          ephemeral: EPHEMERAL,
          game, rank: mine ? mine.rank : null,
          total: board.length,
          improved: score > bestOld,
          boards: games.reduce((acc, g) => { acc[g] = rankOf(db.entries, g); return acc; }, {})
        });
      }).catch(err => {
        sendJSON(res, 503, { ok: false, error: '儲存失敗：' + err.message });
      });
    });
    return;
  }

  sendJSON(res, 404, { ok: false, error: '沒有這個 API' });
}

/* =========================================================
   靜態檔案
   ========================================================= */

/* 伺服器原始碼、部署設定、成績資料不應該被任何人下載。
   就算忘了 gitignore，被抓到公開網址上也只是拿不到這些檔案。 */
const PRIVATE_FILES = new Set([
  'server.js', 'package.json', 'package-lock.json', 'npm-shrinkwrap.json',
  'render.yaml', 'fly.toml', 'procfile', 'railway.json', 'nixpacks.toml',
  'dockerfile', '.gitignore', '.env', '.npmrc', 'readme.md'
]);
const PRIVATE_DIRS = new Set(['data', 'node_modules', '.git', '.github']);

function isPrivatePath(filePath) {
  const rel = path.relative(ROOT, path.resolve(filePath));
  if (!rel || rel.startsWith('..')) return true;
  const parts = rel.split(path.sep);
  if (parts.some(p => p.startsWith('.') && p !== '.' && p !== '..')) return true;
  if (PRIVATE_DIRS.has(parts[0].toLowerCase())) return true;
  return PRIVATE_FILES.has(parts[parts.length - 1].toLowerCase());
}

function serveStatic(req, res, urlPath) {
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  if (isPrivatePath(filePath)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      res.writeHead(302, { Location: urlPath.replace(/\/?$/, '/') + 'index.html' });
      return res.end();
    }
    /* 排行榜資料不要被當成靜態檔案下載 */
    if (path.resolve(filePath) === path.resolve(DB_FILE)) {
      res.writeHead(403); return res.end('Forbidden');
    }
    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><meta charset="utf-8">
          <title>找不到頁面</title>
          <body style="font-family:system-ui;padding:60px;text-align:center;color:#5b5580">
          <h1>404</h1><p>找不到「${escapeHTML(urlPath)}」這個頁面。</p>
          <p><a href="/" style="color:#7b6fd0">回到遊戲總覽</a></p>`);
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]); }
  catch (e) { res.writeHead(400); return res.end('Bad request'); }

  if (urlPath.indexOf('/api/') === 0) return handleAPI(req, res, urlPath);
  return serveStatic(req, res, urlPath);
});

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach(name => {
    (nets[name] || []).forEach(a => {
      if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address });
    });
  });
  return out;
}

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n埠號 ${PORT} 已經被占用，換一個：node server.js ${PORT + 1}\n`);
  } else {
    console.error(e);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = lanAddresses();
  let writable = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    writable = true;
  } catch (e) { writable = false; }

  console.log('');
  console.log('  遊戲學日語 · 伺服器已啟動');
  console.log('  ─────────────────────────────────────');
  console.log(`  本機：       http://localhost:${PORT}`);
  if (lan.length) {
    console.log('  區域網路（手機、平板、其他電腦）：');
    lan.forEach(l => console.log(`    ${l.name.padEnd(12)} http://${l.address}:${PORT}`));
  }
console.log('  ─────────────────────────────────────');
  console.log('  排行榜 API：GET /api/leaderboard · POST /api/leaderboard');
  console.log('  健康檢查：  GET /api/health');
  if (USE_REDIS) {
    console.log('  成績儲存：  Upstash Redis（雲端資料庫，重啟不會消失）');
  } else {
    console.log(`  成績檔案：  ${DB_FILE}`);
  }
  if (!writable) {
    console.log('');
    console.log('  ⚠ 成績資料夾無法寫入！排行榜在這台機器上不會保存。');
  } else if (USE_REDIS) {
    console.log('');
    console.log('  ✓ 排行榜使用 Upstash Redis，重啟後成績不會消失。');
  } else if (EPHEMERAL) {
    console.log('');
    console.log('  ℹ 偵測到暫存磁碟（雲端免費方案常見情況）：');
    console.log('    遊戲可以正常玩，但服務重啟後排行榜成績會被清空。');
    console.log('    永久保存的兩種方式：');
    console.log('      1. 設定 UPSTASH_REDIS_REST_URL 與 UPSTASH_REDIS_REST_TOKEN（免費額度就夠）');
    console.log('      2. 掛載持久磁碟並設定 DATA_DIR');
  }
  console.log('  按 Ctrl+C 停止伺服器');
  console.log('');
});
