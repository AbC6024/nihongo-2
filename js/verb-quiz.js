/* 初級Ⅰ・Ⅱ的動詞練習：每輪抽 10 個不同動詞，逐題說明並整理錯題。 */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  let unkey = null;
  let state = null;
  const levelStars = no => JPQ.store.levelStars('verb-study-v2-' + no);
  const totalStars = () => JPQ.verbStudy.LESSONS.reduce((sum, l) => sum + levelStars(l.no), 0);
  const bookName = book => book === '1' ? '初級Ⅰ字彙' : book === '2' ? '初級Ⅱ字彙' : '初級Ⅰ＋Ⅱ字彙';
  const lessonFor = key => JPQ.verbStudy.lessonFor(key);
  const titleFor = config => config.forms.length === 1 ? lessonFor(config.forms[0]).title : '綜合變化';
  const origin = v => `初級${Number(v.book) === 1 ? 'Ⅰ' : 'Ⅱ'} · 第 ${v.lesson} 課`;
  const ruby = value => U.ruby(U.escapeHTML(value));

  function clearKeys() {
    if (unkey) { unkey(); unkey = null; }
  }

  function showLevels(stage) {
    clearKeys(); state = null;
    stage.innerHTML = `<div class="panel narrow vb-empty"><p class="eyebrow">PRACTICE</p>
      <h2>先選今天的練習</h2><p>從初級Ⅰ、Ⅱ的收錄動詞抽出 10 題，可綜合練習，也可指定一種變化。</p>
      <div class="btn-row"><button type="button" class="btn" id="verbChoose">選擇字彙與變化</button></div></div>`;
    U.$('#verbChoose', stage).addEventListener('click', () => { JPQ.sfx.click(); JPQ.go('#/'); });
    JPQ.hud.set('動詞變化練習', '每輪 10 題 · 不計時');
    JPQ.hud.progress(0); JPQ.hud.clearPills();
  }

  function startRound(config, stage) {
    clearKeys();
    const qs = JPQ.verbGame.build(config);
    if (qs.length !== 10) {
      showLevels(stage);
      JPQ.modal.show({ title: '這個組合暫時無法抽滿 10 題', html: '<p>請換一組字彙或變化再試一次。</p>',
        actions: [{ label: '回練習設定', onClick: () => { JPQ.modal.close(); JPQ.go('#/'); } }] });
      return;
    }
    state = { config: config, i: 0, wrong: 0, qs: qs, answered: false, finished: false, answers: [] };
    renderQuestion(stage);
  }

  function renderQuestion(stage) {
    clearKeys(); state.answered = false;
    const q = state.qs[state.i]; state.q = q;
    const lesson = lessonFor(q.key);
    const opts = U.shuffle(q.opts.concat([q.a]));
    stage.innerHTML = `<div class="panel vb-question">
      <div class="vb-question-head"><span class="vb-origin">${origin(q.verb)}</span>
        <span class="vb-question-number">第 ${state.i + 1} / 10 題</span></div>
      <div class="q-sentence"><span class="vb-word">${ruby(q.from)}</span><span class="vb-arrow" aria-label="變成">→</span>
        <span class="vb-form">${lesson.title}</span></div>
      <div class="q-zh">${U.escapeHTML(q.zh)}</div>
      <p class="vb-question-prompt">請選出正確的${lesson.title}</p>
      <div class="opt-grid vb-options">${opts.map((o, i) => `<button type="button" class="opt" data-o="${U.escapeHTML(o)}">
        <span class="key" aria-hidden="true">${i + 1}</span><span class="vb-option-text">${ruby(JPQ.verb.displayKana(q.verb, o))}</span></button>`).join('')}</div>
      <p class="vb-key-hint">鍵盤 1～3 作答，Enter 前往下一題</p>
      <div class="fb" id="fb" aria-live="polite"></div>
      <div class="btn-row" id="nextRow" hidden><button type="button" class="btn" id="nextBtn">${state.i === 9 ? '看本輪結果 →' : '下一題 →'}</button></div>
    </div>`;
    JPQ.hud.set(titleFor(state.config), bookName(String(state.config.book)) + ' · 每輪 10 題');
    JPQ.hud.progress(state.i / 10); paint();
    U.$$('.opt', stage).forEach(btn => btn.addEventListener('click', () => answer(btn, stage)));
    U.$('#nextBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); next(stage); });
    unkey = JPQ.onKey(e => {
      const n = Number(e.key);
      if (n >= 1 && n <= opts.length && Number.isInteger(n)) {
        const btn = U.$$('.opt', stage)[n - 1];
        if (btn && !btn.disabled) { e.preventDefault(); answer(btn, stage); }
      } else if (e.key === 'Enter' && state && state.answered) { e.preventDefault(); next(stage); }
    });
  }

  function paint() {
    JPQ.hud.pills([{ label: '答對', value: state.answers.filter(a => a.ok).length }, { label: '答錯', value: state.wrong }]);
  }

  function answer(btn, stage) {
    if (!state || state.finished || state.answered) return;
    state.answered = true;
    const pick = btn.dataset.o, q = state.q, ok = pick === q.a;
    state.answers.push({ q: q, pick: pick, ok: ok });
    U.$$('.opt', stage).forEach(b => {
      b.disabled = true;
      if (b.dataset.o === q.a) b.classList.add('correct');
      else if (b === btn) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    if (ok) JPQ.sfx.correct(); else { state.wrong++; JPQ.sfx.wrong(); }
    JPQ.stats.answer('形:' + q.key, ok);
    const fb = U.$('#fb', stage);
    fb.className = 'fb show ' + (ok ? 'ok' : 'no');
    fb.innerHTML = `<strong>${ok ? '答對了！' : '再記一次這個變化'}</strong>
      <p class="vb-answer">${ruby(q.from)} → ${ruby(JPQ.verb.displayKana(q.verb, q.a))}</p>
      <p class="vb-tip">${U.escapeHTML(JPQ.verbStudy.tip(q.verb, q.key))}</p><p>${lessonFor(q.key).sub}</p>`;
    U.$('#nextRow', stage).hidden = false;
    U.$('#nextBtn', stage).focus({ preventScroll: true }); paint();
  }

  function next(stage) {
    if (!state || !state.answered || state.finished) return;
    state.i++;
    if (state.i >= 10) finish(stage); else renderQuestion(stage);
  }

  function reviewHTML(answers) {
    return answers.map((a, i) => `<li class="vb-review-item">
      <div class="vb-review-heading"><strong>${i + 1}. ${ruby(a.q.from)}</strong><span>${lessonFor(a.q.key).title}</span></div>
      <p class="vb-review-origin">${U.escapeHTML(a.q.zh)} · ${origin(a.q.verb)}</p>
      ${!a.ok ? `<p class="vb-picked">你的答案：${ruby(JPQ.verb.displayKana(a.q.verb, a.pick))}</p>` : ''}
      <p class="vb-correct-answer">正確答案：${ruby(JPQ.verb.displayKana(a.q.verb, a.q.a))}</p>
      <p class="vb-tip">${U.escapeHTML(JPQ.verbStudy.tip(a.q.verb, a.q.key))}</p></li>`).join('');
  }

  function finish(stage) {
    if (!state || state.finished) return;
    state.finished = true; clearKeys();
    const config = state.config, right = 10 - state.wrong;
    const stars = right === 10 ? 3 : right >= 8 ? 2 : 1;
    const form = config.forms.length === 1 ? config.forms[0] : 'mixed';
    const lesson = form === 'mixed' ? null : lessonFor(form);
    const saveKey = lesson ? 'verb-study-v2-' + lesson.no : 'verb-study-round-mixed-' + config.book;
    JPQ.store.setLevelStars(saveKey, stars); JPQ.stats.run('verb-quiz', 10, right);
    JPQ.hud.progress(1); JPQ.hud.pills([{ label: '正確率', value: (right * 10) + '%' }]);
    if (right === 10) { JPQ.sfx.levelup(); JPQ.fx.center(); }
    const wrongAnswers = state.answers.filter(a => !a.ok);
    stage.innerHTML = `<section class="panel vb-result" id="verbResult" aria-labelledby="verbResultTitle">
      <p class="eyebrow">ROUND COMPLETE</p><h2 id="verbResultTitle">本輪練習完成</h2>
      <p class="vb-result-sub">${titleFor(config)} · ${bookName(String(config.book))}</p>
      <div class="vb-round-score"><strong>${right}<span> / 10</span></strong><p>正確率 ${right * 10}%</p></div>
      <p class="vb-result-message">${right === 10 ? '10 題全對！再換一組動詞，讓變化更熟練。' : '把下面的錯題再看一次，再抽一組繼續練習。'}</p>
      <div class="btn-row"><button type="button" class="btn" id="verbRetry">再抽 10 題</button>
        <button type="button" class="btn grey" id="verbSettings">換練習設定</button></div>
      <details class="vb-review" ${wrongAnswers.length ? 'open' : ''}>
        <summary>${wrongAnswers.length ? '錯題複習 · ' + wrongAnswers.length + ' 題' : '回顧本輪的 10 題'}</summary>
        <ol id="verbReview">${reviewHTML(wrongAnswers.length ? wrongAnswers : state.answers)}</ol></details></section>`;
    U.$('#verbRetry', stage).addEventListener('click', () => { JPQ.sfx.click(); startRound(config, stage); global.scrollTo(0, 0); });
    U.$('#verbSettings', stage).addEventListener('click', () => { JPQ.sfx.click(); JPQ.go('#/'); });
    global.scrollTo(0, 0);
  }

  JPQ.registerGame({ name: 'verb-quiz', title: '動詞變化練習', sub: '初級Ⅰ・Ⅱ · 每輪 10 題',
    card: { thumb: 'quiz', icon: '🎯', color: '#93a4f0', title: '動詞變化練習',
      desc: '從初級Ⅰ、Ⅱ收錄動詞抽 10 題，綜合練習或指定一種變化。', tag: '不計時' },
    best: () => totalStars() ? totalStars() + ' ⭐' : '',
    mount(stage) { clearKeys(); const config = JPQ.verbStudy.configFor(location.hash);
      if (config) startRound(config, stage); else showLevels(stage); },
    unmount() { clearKeys(); state = null; }
  });
})(window);
