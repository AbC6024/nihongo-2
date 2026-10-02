/* =========================================================
   遊戲學日語 — 本機 / 區域網路伺服器
   用法：node server.js [埠號]   預設 8000
   ========================================================= */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]); }
  catch (e) { res.writeHead(400); return res.end('Bad request'); }

  if (urlPath === '/') urlPath = '/index.html';

  /* 副檔名也當成乾淨網址：/particles -> /particles.html */
  const filePath = path.join(ROOT, urlPath);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      res.writeHead(302, { Location: urlPath.replace(/\/?$/, '/') + 'index.html' });
      return res.end();
    }
    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><meta charset="utf-8">
          <title>找不到頁面</title>
          <body style="font-family:system-ui;padding:60px;text-align:center;color:#5b5580">
          <h1>404</h1><p>找不到「${urlPath}」這個頁面。</p>
          <p><a href="/" style="color:#7b6fd0">回到遊戲總覽</a></p>`);
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  });
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
  console.log('');
  console.log('  遊戲學日語 · 伺服器已啟動');
  console.log('  ─────────────────────────────────────');
  console.log(`  本機：       http://localhost:${PORT}`);
  if (lan.length) {
    console.log('  區域網路（手機、平板、其他電腦）：');
    lan.forEach(l => console.log(`    ${l.name.padEnd(12)} http://${l.address}:${PORT}`));
  } else {
    console.log('  （沒有找到區域網路介面卡）');
  }
  console.log('  ─────────────────────────────────────');
  console.log('  按 Ctrl+C 停止伺服器');
  console.log('');
});
