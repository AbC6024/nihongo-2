/* 學習紀錄：依學習內容分類，沿用既有瀏覽器資料。 */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  const PARTICLES = ['は', 'が', 'を', 'に', 'で', 'と', 'も', 'の'];
  const NAMES = { 'は':'主題', 'が':'主語', 'を':'動作的對象', 'に':'方向・對象', 'で':'場所・方法', 'と':'和・一起', 'も':'也', 'の':'所屬・修飾' };
  const FORMS = [
    ['masu','ます形',1], ['te','て形',2], ['nai','ない形',3], ['base','辞書形',4], ['ta','た形',5],
    ['dekita','可能形',6], ['you','意向形',7], ['meirei','命令形',8], ['kinshi','禁止形',9],
    ['kate','條件形（ば形）',10], ['ukerare','受身形',11], ['saseru','使役形',12],
    ['tai','連体形'], ['masen','ません'], ['mashita','ました'], ['masendeshita','ませんでした'],
    ['mashimashou','ましょう'], ['masenka','ませんか'], ['darou','だろう'], ['naiwake','ない形（舊題型）'],
    ['dekitaimasu','可能形・ます'], ['ukeraremasen','受身形・ません'], ['sasenai','使役形・ない']
  ];
  const GAMES = { quiz:'助詞選擇題', speed:'助詞搶答', scramble:'助詞拼圖', match:'助詞配對',
    'verb-quiz':'動詞變化練習', 'verb-speed':'動詞搶答', 'verb-scramble':'動詞拼圖', 'verb-match':'動詞配對',
    'kana-order':'五十音順序', 'kana-convert':'平片假名對照', 'kana-listen':'聽音選字' };
  const SCOPES = [['all','總覽'], ['particles','助詞'], ['verbs','動詞'], ['kana','五十音']];
  const number = n => Math.max(0, Number(n) || 0);
  const category = game => String(game).startsWith('verb-') ? 'verbs' : String(game).startsWith('kana-') ? 'kana' : 'particles';
  const percent = (right, total) => total ? Math.round(right / total * 100) : null;
  const dateKey = at => { const d = new Date(at); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); };

  function summary(scope = 'all') {
    const d = JPQ.store.load(), stats = d.stats || {}, acc = stats.acc || {};
    const runs = (stats.runs || []).filter(r => scope === 'all' || category(r.game) === scope);
    const total = runs.reduce((n,r) => n + number(r.total), 0);
    const right = runs.reduce((n,r) => n + Math.min(number(r.total), number(r.right)), 0);
    const topic = (key, label, name, group, href) => {
      const a = acc[key] || {}, t = number(a.total), c = Math.min(t, number(a.correct));
      return { k:key, label, name, group, href, total:t, correct:c, rate:percent(c,t) };
    };
    const byParticle = PARTICLES.map(k => topic(k,k,NAMES[k],'particles','particles.html#/play/quiz'));
    const byVerb = FORMS.map(f => topic('形:'+f[0], f[1], '動詞變化', 'verbs',
      f[2] ? 'conjugation.html#/play/verb-quiz/'+f[2] : 'conjugation.html'));
    const byKana = ['kana-order','kana-convert','kana-listen'].map(game => {
      const list = (stats.runs || []).filter(r => r.game === game);
      const t = list.reduce((n,r) => n+number(r.total),0), c = list.reduce((n,r) => n+Math.min(number(r.total),number(r.right)),0);
      return { k:game, label:GAMES[game], name:'五十音', group:'kana', total:t, correct:c, rate:percent(c,t), href:'gojuon.html' };
    });
    const topics = byParticle.concat(byVerb,byKana).filter(t => scope === 'all' || t.group === scope);
    const recent = runs.slice().sort((a,b) => number(b.at)-number(a.at)).slice(0,6);
    return { sessions:runs.length, total, right, wrong:total-right, rate:percent(right,total),
      bestRate:runs.reduce((n,r) => Math.max(n,percent(number(r.right),number(r.total)) || 0),0),
      streak:JPQ.stats.streak(), today:runs.filter(r => dateKey(r.at) === dateKey(Date.now())).length,
      byParticle, byVerb, byKana, topics, recent, hasData:runs.length > 0 || topics.some(t => t.total > 0) };
  }

  function topicRow(t) {
    const status = !t.total ? '還沒練習' : t.total < 5 ? '再累積幾題' : t.rate >= 80 ? '表現不錯' : '可以再練練';
    return `<div class="lr-topic ${t.total >= 5 && t.rate < 80 ? 'needs-review' : ''}">
      <div class="lr-topic-head"><strong>${t.label}</strong><span>${status}</span></div>
      <div class="lr-topic-meta"><span>${t.name} · ${t.total ? '答對 '+t.correct+' / '+t.total+' 題' : '從一輪練習開始'}</span><b>${t.rate === null ? '—' : t.rate+'%'}</b></div>
      <div class="lr-track" aria-label="${t.label}正確率${t.rate === null ? '尚無紀錄' : t.rate+'%'}"><span class="lr-fill" style="width:${t.rate || 0}%"></span></div>
      <a href="${t.href}" class="lr-practice">${t.total ? '再練一次' : '開始練習'} →</a>
    </div>`;
  }

  function bodyHTML(scope = 'all') {
    if (!SCOPES.some(s => s[0] === scope)) scope = 'all';
    const s = summary(scope);
    const tabs = `<div class="lr-filters" role="group" aria-label="學習內容分類">${SCOPES.map(t =>
      `<button type="button" data-lr-scope="${t[0]}" aria-pressed="${t[0] === scope}">${t[1]}</button>`).join('')}</div>`;
    const href = scope === 'verbs' ? 'conjugation.html' : scope === 'kana' ? 'gojuon.html' : 'particles.html';
    const start = `<div class="lr-empty"><span class="lr-empty-icon" aria-hidden="true">✏️</span><h4>從一小步開始</h4>
      <p>這裡還沒有紀錄。完成一輪練習，就能看到答題表現。</p>
      <div class="lr-start-links">${scope === 'all'
        ? '<a class="btn" href="particles.html">練助詞</a><a class="btn grey" href="conjugation.html">練動詞</a><a class="btn grey" href="gojuon.html">練五十音</a>'
        : '<a class="btn" href="'+href+'">開始練習 →</a>'}</div></div>`;
    const cards = [
      [s.sessions, '完成練習', '輪'], [s.total, '完成的答題', '題'],
      [s.rate === null ? '—' : s.rate+'%', '正確率', s.total ? '答對 '+s.right+' 題' : '完成練習後顯示'],
      [scope === 'all' ? s.streak : s.today, scope === 'all' ? '連續練習' : '今天完成', scope === 'all' ? '天' : '輪']
    ].map(c => `<div class="lr-card"><span class="lr-lab">${c[1]}</span><b class="lr-num">${c[0]}</b><span class="lr-card-sub">${c[2]}</span></div>`).join('');
    const tried = s.topics.filter(t => t.total > 0);
    const review = tried.filter(t => t.total >= 5 && t.rate < 80).sort((a,b) => a.rate-b.rate).slice(0,3);
    const suggestion = review.length
      ? `<p>下次可以先練這幾項，一次選一個就好。</p><div class="lr-review-links">${review.map(t => `<a href="${t.href}">${t.label}<span>${t.rate}% · 再練一次 →</span></a>`).join('')}</div>`
      : `<p>${tried.some(t => t.total >= 5) ? '目前沒有低於 80% 且已練 5 題的項目。可以複習熟悉的內容，或試試新的變化。' : '目前題數還不多，先完成幾輪練習，再看看哪些地方需要複習。'}</p><a class="lr-practice" href="${href}">繼續練習 →</a>`;
    const details = scope === 'all'
      ? `<div class="lr-category-grid">${SCOPES.slice(1).map(c => { const g=summary(c[0]); return `<button type="button" data-lr-scope="${c[0]}"><strong>${c[1]}</strong><span>${g.sessions} 輪練習 · ${g.rate === null ? '尚無完成紀錄' : '正確率 '+g.rate+'%'}</span><b aria-hidden="true">→</b></button>`; }).join('')}</div>`
      : `<section class="lr-section"><h4>各項表現</h4><p class="lr-section-note">${scope === 'kana' ? '依已完成的練習統計。' : '包含已回答的題目，尚未完成的一輪也會計入。'}</p>
        <div class="lr-topic-grid">${tried.length ? tried.map(topicRow).join('') : '<p>完成練習後，這裡就會出現各項表現。</p>'}</div>
        ${s.topics.some(t => !t.total) ? `<details class="lr-untried"><summary>還沒練過的項目</summary><div class="lr-topic-grid">${s.topics.filter(t => !t.total && (t.group !== 'verbs' || FORMS.find(f => '形:'+f[0] === t.k)[2])).map(topicRow).join('')}</div></details>` : ''}</section>`;
    const recent = `<section class="lr-section"><h4>最近練習</h4>${s.recent.length
      ? '<ul class="lr-history">'+s.recent.map(r => {const t=number(r.total),c=Math.min(t,number(r.right));return `<li><div><strong>${U.escapeHTML(GAMES[r.game] || '日語練習')}</strong><time>${Number.isFinite(new Date(r.at).getTime()) ? new Date(r.at).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}) : '日期未記錄'}</time></div><span>答對 ${c} / ${t} 題</span><b>${t ? percent(c,t)+'%' : '—'}</b></li>`;}).join('')+'</ul>'
      : '<p class="lr-section-note">完成一輪後，這裡會顯示練習時間和結果。</p>'}</section>`;
    return `<div class="lr-dashboard"><p class="lr-intro">看看自己的進步，再選一項繼續練習。</p>${tabs}
      ${s.hasData ? `<div class="lr-cards">${cards}</div><p class="lr-section-note">重點數字依最近保留的已完成練習統計，最多 500 輪。${scope === 'all' ? '連續天數包含所有學習內容。' : ''}</p>
      <section class="lr-review"><h4>下一步練什麼？</h4>${suggestion}</section>${details}${recent}` : start}
      <details class="lr-settings"><summary>紀錄保存與設定</summary><p>紀錄只保存在目前的瀏覽器，不會上傳。換裝置或清除瀏覽器資料後，不會同步保留。</p>
      <button type="button" class="lr-reset" data-lr-reset>清除學習紀錄</button></details></div>`;
  }

  JPQ.learn = {
    summary, bodyHTML,
    open: function (scope = 'all') {
      JPQ.modal.show({ title:'學習紀錄', html:'<div id="lrBody"></div>', wide:true, learning:true,
        actions:[{label:'關閉',cls:'grey',onClick:()=>JPQ.modal.close()}] });
      const host = U.$('#lrBody');
      if (!host) return;
      const render = selected => {
        host.innerHTML = bodyHTML(selected);
        const panel = U.$('#modalBody');
        if (panel) panel.scrollTop = 0;
        const active = U.$('.lr-filters [aria-pressed="true"]',host);
        if (active) active.focus({preventScroll:true});
        U.$$('[data-lr-scope]',host).forEach(b => b.addEventListener('click', () => { JPQ.sfx.click(); render(b.dataset.lrScope); }));
        U.$$('a',host).forEach(a => a.addEventListener('click', () => JPQ.modal.close()));
        const reset = U.$('[data-lr-reset]',host);
        if (reset) reset.addEventListener('click', () => JPQ.modal.show({ title:'清除學習紀錄？',
          html:'<p>答題統計與最近練習會被刪除，無法復原。</p><p>星星、遊戲進度與排行榜成績會保留。</p>',
          actions:[{label:'取消',cls:'grey',onClick:()=>JPQ.learn.open(selected)},
            {label:'確定清除',onClick:()=>{JPQ.stats.reset();JPQ.learn.open(selected);if(JPQ.home)JPQ.home.render();}}] }));
      };
      render(scope);
    }
  };
})(window);
