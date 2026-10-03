/* 臨時測試：線上正式環境（唯讀，不寫入成績） */
(function (global) {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const log = []; let out;
  function say(s) { log.push(s); if (out) out.textContent = log.join('\n'); }
  function ok(c, m) { say((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) global.__fail = true; }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(sel, ms) {
    ms = ms || 8000; const t0 = Date.now();
    while (Date.now() - t0 < ms) { if ($(sel)) return true; await wait(80); }
    return false;
  }
  const errors = [];
  global.addEventListener('error', e => errors.push(e.message));

  async function run() {
    await wait(120);
    out = document.createElement('pre'); out.id = 'testout';
    out.style.cssText = 'white-space:pre-wrap;font:12px monospace;padding:12px;background:#111;color:#0f0';
    document.body.appendChild(out);
    function report() { try { fetch('http://127.0.0.1:8181/result', { method: 'POST', body: log.join('\n') }); } catch (e) {} }
    global.report = report;
    say('=== 線上正式環境唯讀測試 ===');
    say('origin: ' + location.origin);

    await wait(800);
    ok(JPQ && typeof JPQ.LB_GAMES === 'object', 'JPQ 有載入');
    ok(Object.keys(JPQ.LB_GAMES).length === 7, '7 種遊戲排行榜設定：' + Object.keys(JPQ.LB_GAMES).length);

    ok(await JPQ.lb.probe() === true, '排行榜 API 連線成功（相對路徑在線上可運作）');
    ok(JPQ.lb.ephemeral === true, '偵測到暫存磁碟 → 前端知道要提醒玩家');

    location.hash = '#/'; await wait(300);
    await waitFor('.lb-warn');
    ok(!!$('.lb-warn'), '排行榜上方顯示「這份排行榜是暫時的」');
    ok($('.lb-warn').textContent.indexOf('存在瀏覽器裡') > -1, '說明玩家個人進度不受影響（文字正常無亂碼）');
    ok(!!$('.lb-tabs'), '排行榜分頁有渲染');
    ok($$('.lb-tab').length === 7, '七個分頁');

    /* 遊戲本身能載入 */
    ok(!!document.querySelector('header'), '頁面 header 有渲染');
    const ruby = $$('ruby');
    ok(ruby.length > 0, '假名注音 <ruby> 有渲染：' + ruby.length + ' 個');

    ok(errors.length === 0, '沒有 JS 錯誤' + (errors.length ? '：' + errors.join(' | ') : ''));

    say('=== done: ' + (global.__fail ? 'HAS FAILURES' : 'ALL PASS') + ' ===');
    report();
  }
  const go = () => run().catch(e => { say('EXCEPTION: ' + e.message); report(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})(window);