'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function compileJavaScript() {
  const files = fs.readdirSync(path.join(ROOT, 'js'))
    .filter(file => file.endsWith('.js'))
    .concat(['server.js']);

  files.forEach(file => {
    const fullPath = file === 'server.js'
      ? path.join(ROOT, file)
      : path.join(ROOT, 'js', file);
    new vm.Script(fs.readFileSync(fullPath, 'utf8'), { filename: file });
  });
}

function validateLearningData() {
  const sandbox = {};
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  ['data.js', 'kana-data.js'].forEach(file => {
    const source = fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
    new vm.Script(source, { filename: file }).runInContext(context);
  });

  const JPQ = context.JPQ;
  const questions = JPQ.LEVELS.flatMap(level => level.qs).concat(JPQ.SPEED_EXTRA);
  questions.forEach((question, index) => {
    assert.strictEqual((question.q.match(/__/g) || []).length, 1,
      `Question ${index + 1} must contain exactly one blank`);
    assert(question.opts.includes(question.a), `Question ${index + 1} is missing its answer`);
    assert.strictEqual(new Set(question.opts).size, question.opts.length,
      `Question ${index + 1} contains duplicate options`);
  });

  assert.strictEqual(JPQ.kana.list().length, 46, 'The basic kana list must contain 46 entries');
  assert.strictEqual(JPQ.kana.toKatakana('きゃ'), 'キャ');
  assert.strictEqual(JPQ.kana.toKatakana('し'), 'シ');
  assert.strictEqual(JPQ.KANA.find(row => row.row === 'や行').cells[2][0], 'ゆ');
  assert.strictEqual(JPQ.KANA.find(row => row.row === 'や行').cells[4][0], 'よ');
  assert.strictEqual(JPQ.KANA.find(row => row.row === 'わ行').cells[4][0], 'を');

  const learningSource = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
  [
    '日本語[にほんご]__　なれます',
    '妹[まなこ]',
    '休[やす]み日[び]',
    '東京[とうきょう]__　住[す]みます',
    '象[ぞう]__　鼻[はな]は　長[なが]いです。',
    '「これ／それ／あれ」開頭的這類疑問句固定用「は」',
    '今日[きょう]は寒[さむ]いです。妹[いもうと]__　セーターを着[き]ます。',
    '「也」「還有」，會取代原本的 は／が'
  ]
    .forEach(text => assert(!learningSource.includes(text), `Known invalid example returned: ${text}`));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(err => err ? reject(err) : resolve(port));
    });
  });
}

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port, path: pathname,
      method: options.method || 'GET', headers: options.headers || {}
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.once('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
    try {
      const result = await request(port, '/api/health');
      if (result.status === 200) return;
    } catch (error) {
      // The server may still be binding the port.
    }
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error('Timed out waiting for the test server');
}

async function validateServer() {
  const port = await freePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihongo-2-test-'));
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js'), String(port)], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR: tempDir, DB_FILE: path.join(tempDir, 'leaderboard.json') },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });

  try {
    await waitForServer(port, child);

    const post = payload => request(port, '/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let result = await post({ game: 'speed', name: 'Alice', score: 100, detail: 'high score' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(JSON.parse(result.body).improved, true);

    result = await post({ game: 'speed', name: 'Alice', score: 80, detail: 'lower score' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(JSON.parse(result.body).improved, false);

    result = await request(port, '/api/leaderboard');
    const board = JSON.parse(result.body).boards.speed;
    assert.strictEqual(board[0].score, 100, 'A lower score must not replace the personal best');
    assert.strictEqual(board[0].detail, 'high score', 'A lower score must not replace best-score details');

    result = await post({ game: 'unknown-game', name: 'Alice', score: 1 });
    assert.strictEqual(result.status, 400, 'Unknown games must be rejected');

    result = await request(port, '/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'speed', name: 'A', score: 1, detail: 'x'.repeat(5000) })
    });
    assert.strictEqual(result.status, 413, 'Oversized requests must receive HTTP 413');

    result = await request(port, '/server.js');
    assert.strictEqual(result.status, 403, 'Private source files must not be served');

    result = await request(port, '/%3Cscript%3E');
    assert.strictEqual(result.status, 404);
    assert(!result.body.includes('<script>'), 'The 404 page must escape the requested path');
    assert(result.body.includes('&lt;script&gt;'));
  } finally {
    child.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  if (stderr) throw new Error(stderr);
}

async function main() {
  compileJavaScript();
  validateLearningData();
  await validateServer();
  console.log('Smoke tests passed.');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
