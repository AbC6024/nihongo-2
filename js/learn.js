/* =========================================================
   學習紀錄 — 統計數字 + 各助詞正確率
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;

  /* 八大助詞的固定順序，跟網站其他地方的寫法一致 */
  const PARTICLES = ['は', 'が', 'を', 'に', 'で', 'と', 'も', 'の'];

  /* 各助詞的名稱，放在長條圖旁邊當說明 */
  const NAMES = {
    'は': '主題', 'が': '主語', 'を': '賓語', 'に': '方向・對象',
    'で': '場所・手段', 'と': '和・一起', 'も': '也', 'の': '連體修飾'
  };

  function summary() {
    const d = JPQ.store.load();
    const runs = (d.stats && d.stats.runs) || [];
    const acc = (d.stats && d.stats.acc) || {};

    let total = 0, right = 0;
    runs.forEach(r => { total += r.total || 0; right += r.right || 0; });

    /* 總正確率 */
    const rate = total ? Math.round(right / total * 100) : 0;

    /* 每一場遊戲各自的正確率，取最高那場當「最高正確率」 */
    let bestRate = 0;
    runs.forEach(r => {
      if (!r.total) return;
      const p = Math.round(r.right / r.total * 100);
      if (p > bestRate) bestRate = p;
    });

    /* 各助詞正確率 */
    const byParticle = PARTICLES.map(k => {
      const a = acc[k] || { correct: 0, total: 0 };
      return {
        k: k, name: NAMES[k] || '', correct: a.correct, total: a.total,
        rate: a.total ? Math.round(a.correct / a.total * 100) : null
      };
    });

    return {
      sessions: runs.length,
      total: total,
      right: right,
      wrong: total - right,
      rate: rate,
      bestRate: bestRate,
      streak: JPQ.stats.streak(),
      byParticle: byParticle
    };
  }

  function cardsHTML(s) {
    return [
      { n: s.sessions, l: '遊玩次數', e: '遊戲數' },
      { n: s.total, l: '答題總數', e: '問題數' },
      { n: s.right, l: '答對', e: '正解' },
      { n: s.wrong, l: '答錯', e: '不正解' },
      { n: s.total ? s.rate + '%' : '—', l: '總正確率', e: 'overall' },
      { n: s.total ? s.bestRate + '%' : '—', l: '最高正確率', e: 'best' }
    ].map(c => `<div class="lr-card">
      <b class="lr-num">${c.n}</b>
      <span class="lr-lab">${c.l}</span>
      <em class="lr-en">${c.e}</em>
    </div>`).join('');
  }

  function barsHTML(s) {
    return s.byParticle.map(p => {
      if (p.rate === null) {
        return `<div class="lr-bar-row is-void">
          <span class="lr-k">${p.k}</span>
          <span class="lr-track"><span class="lr-fill" style="width:0"></span></span>
          <span class="lr-pct">—</span>
        </div>`;
      }
      return `<div class="lr-bar-row${p.rate >= 80 ? ' good' : (p.rate < 50 ? ' weak' : '')}">
        <span class="lr-k">${p.k}</span>
        <span class="lr-track"><span class="lr-fill" style="width:${p.rate}%"></span></span>
        <span class="lr-pct">${p.rate}%<em>(${p.correct}/${p.total})</em></span>
      </div>`;
    }).join('');
  }

  /* 依每個助詞的答題量給一點建議 */
  function advice(s) {
    const tried = s.byParticle.filter(p => p.total > 0);
    if (!tried.length) return '還沒有答題紀錄，先去玩一局吧！';

    const weak = tried.filter(p => p.rate < 60).sort((a, b) => a.rate - b.rate);
    const strong = tried.filter(p => p.rate >= 80);
    const lines = [];

    if (weak.length) {
      const names = weak.map(p => `「${p.k}」`).join('、');
      lines.push(`<b>${names}</b> 還要加強，正確率偏低，多看幾次講解。`);
    }
    if (strong.length) {
      const names = strong.map(p => p.k).join('、');
      lines.push(`<b>${names}</b> 表現很好，已經穩穩的。`);
    }
    if (s.streak > 1) lines.push(`連續練習 <b>${s.streak}</b> 天，別中斷喔！`);
    return lines.join(' ');
  }

  JPQ.learn = {
    summary: summary,

    /* 內容 HTML，給彈窗用 */
    bodyHTML: function () {
      const s = summary();
      if (!s.total && !s.sessions) {
        return `<div class="lr-empty">
          <p>還沒有學習紀錄。</p>
          <p class="lr-empty-sub">去玩一局助詞大冒險，玩完這裡就會記錄你的答題表現。</p>
          <button class="btn" onclick="JPQ.go('particles.html')">去玩助詞大冒險 →</button>
        </div>`;
      }
      return `
        <div class="lr-cards">${cardsHTML(s)}</div>
        <div class="lr-advise">${advice(s)}</div>
        <h4 class="lr-h4">各助詞正確率 <em>助詞ごとの正答率</em></h4>
        <div class="lr-bars">${barsHTML(s)}</div>
        <p class="lr-note">學習紀錄只存在這台電腦的瀏覽器裡，不會上傳。</p>
        <div class="lr-actions">
          <button class="btn grey" data-lr-reset>清除學習紀錄</button>
        </div>`;
    },

    open: function () {
      JPQ.modal.show({
        title: '學習紀錄',
        html: '<div id="lrBody"></div>',
        wide: true,
        actions: [{ label: '關閉', cls: 'grey', onClick: () => JPQ.modal.close() }]
      });
      const host = document.getElementById('lrBody');
      if (!host) return;
      host.innerHTML = this.bodyHTML();

      const reset = U.$('[data-lr-reset]', host);
      if (reset) reset.addEventListener('click', () => {
        JPQ.modal.show({
          title: '確定要清除？',
          html: '<p>學習紀錄會全部消失，而且無法復原。</p>' +
                '<p style="color:#8b91ad;font-size:14px;margin-top:8px">' +
                '（遊戲進度與排行榜成績不受影響）</p>',
          actions: [
            { label: '取消', cls: 'grey', onClick: () => JPQ.learn.open() },
            { label: '確定清除', onClick: () => { JPQ.stats.reset(); JPQ.learn.open(); } }
          ]
        });
      });
    }
  };
})(window);