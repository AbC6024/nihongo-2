/* =========================================================
   動詞活用 — 遊戲 3：活用表拼圖
   ------------------------------------------------------------
   其他玩法都給你整個詞形讓你認，這個玩法反過來：
   詞幹給你，詞尾要自己挑。

   走完一輪，一整列活用表就會拼在你的畫面上——
   這才看得出「する 只是替換、行く 只差一個促音」這種差別。
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  const verb = JPQ.verb;
  let unkey = null;
  let state = null;

  /* 拼圖只用「詞尾有意義」的活用形。
     辞書形 和 連体形 本來就沒有詞尾，放進來只是佔位。 */
  const PUZZLE_FORMS = ['te', 'ta', 'nai', 'masu', 'masen', 'mashita',
                        'masendeshita', 'you', 'meirei', 'kate', 'darou'];

  function intro(stage) {
    state = null;
    stage.innerHTML = `<div class="panel narrow center">
      <h2>活用表拼圖</h2>
      <p class="section-note" style="margin-top:10px">
        詞幹已經給你了，詞尾要自己挑。<br>
        挑完一整輪，一列完整的活用表就會出現在畫面上。
      </p>
      <p style="font-size:13px;color:#8b91ad;margin-top:8px">
        提示：五段動詞的詞尾比較沒有規律，這關就是拿來練那個的
      </p>
      <div class="btn-row">
        <button class="btn" id="startBtn">開始拼</button>
        <button class="btn grey" id="backBtn">回主頁</button>
      </div>
    </div>`;
    JPQ.hud.set('活用表拼圖', '把詞尾接回去');
    JPQ.hud.progress(0);
    JPQ.hud.pills([]);
    U.$('#startBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); start(stage); });
    U.$('#backBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); JPQ.go('#/'); });
  }

  /* 挑一個「值得拼」的動詞：能拼的活用形夠多 */
  function pickVerb() {
    const cands = verb.VERBS.filter(v => {
      const n = verb.formsFor(v).filter(f => PUZZLE_FORMS.indexOf(f.key) !== -1).length;
      return n >= 6;
    });
    return U.pick(cands);
  }

  /* 這一輪要拼的活用形 */
  function pickForms(v) {
    const usable = verb.formsFor(v)
      .filter(f => PUZZLE_FORMS.indexOf(f.key) !== -1)
      .map(f => f.key);
    return U.shuffle(usable).slice(0, 8);
  }

  /* 干擾詞尾：同樣是這個動詞別列的詞尾，或其他動詞的同樣活用形 */
  function distractorTails(v, key, realTail) {
    const set = new Set();
    const add = t => {
      if (t && t !== realTail && t.length >= 1 && t.length <= 4) set.add(t);
    };
    verb.formsFor(v).forEach(f => {
      if (f.key === key) return;
      const sp = verb.split(v, f.key);
      if (sp) add(sp.tail);
    });
    const others = U.shuffle(verb.VERBS.filter(x => x.kana !== v.kana)).slice(0, 6);
    others.forEach(o => {
      if (!verb.supports(o, key)) return;
      const sp = verb.split(o, key);
      if (sp) add(sp.tail);
    });
    const arr = Array.from(set);
    U.shuffle(arr);
    return arr.slice(0, 3);
  }

  function start(stage) {
    const v = pickVerb();
    const keys = pickForms(v);
    if (!keys.length) {
      JPQ.modal.show({
        title: '出題失敗',
        html: '<p>這個動詞目前排不出拼圖，請再試一次。</p>',
        actions: [{ label: '再試一次', onClick: () => { JPQ.modal.close(); start(stage); } }]
      });
      return;
    }
    state = { v: v, keys: keys, i: 0, wrong: 0, rows: keys.map(k => verb.split(v, k)) };
    render(stage);
  }

  function render(stage) {
    if (unkey) { unkey(); unkey = null; }
    const v = state.v;
    const done = state.i;

    const rows = state.keys.map((k, n) => {
      const sp = state.rows[n];
      const f = verb.form(k);
      const filled = n < done;
      const active = n === done;
      const okTail = filled && state.answers && state.answers[n] === sp.tail;
      const shown = filled ? sp.tail : (active ? '<span class="vb-slot-on">？</span>' : '<span class="vb-slot">？</span>');
      return `<tr class="vb-row${filled ? ' done' : ''}${active ? ' active' : ''}${filled && !okTail ? ' miss' : ''}">
        <th>${f.label}<em>${f.en}</em></th>
        <td class="vb-head">${sp.head}</td>
        <td class="vb-tail">${shown}</td>
        <td class="vb-full">${filled ? U.ruby(verb.display(v, k)) : ''}</td>
      </tr>`;
    }).join('');

    const key = state.keys[done];
    const sp = state.rows[done];
    const opts = U.shuffle([sp.tail].concat(distractorTails(v, key, sp.tail)));

    stage.innerHTML = `<div class="panel">
      <div class="q-sentence center">
        <span class="vb-word">${U.ruby(verb.display(v, 'base'))}</span>
        <span class="vb-zh">${v.zh}</span>
        <button class="vb-say" id="sayBtn" type="button" title="聽發音">🔊</button>
      </div>
      <p class="center section-note" style="margin-bottom:10px">
        輪到第 <b>${done + 1}</b> / ${state.keys.length} 格：<b>${verb.form(key).label}</b>
        該接哪個詞尾？
      </p>
      <table class="vb-table"><tbody>${rows}</tbody></table>
      <div class="opt-grid" id="vbOpts">
        ${opts.map((o, i) => `<button class="opt" data-o="${U.escapeHTML(o)}">
          <span class="key">${i + 1}</span>${U.escapeHTML(o)}</button>`).join('')}
      </div>
      <div class="fb" id="fb"></div>
      <div class="btn-row" id="nextRow" style="display:none">
        <button class="btn" id="nextBtn">繼續 →</button>
      </div>
    </div>`;

    const sayBtn = U.$('#sayBtn', stage);
    if (sayBtn) sayBtn.addEventListener('click', () => { JPQ.sfx.click(); JPQ.speech.say(v.kana); });

    U.$$('#vbOpts .opt', stage).forEach(btn =>
      btn.addEventListener('click', () => answer(btn, stage)));
    U.$('#nextBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); step(stage); });

    paint();
    unkey = JPQ.onKey(e => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= opts.length) {
        const btn = U.$$('#vbOpts .opt', stage)[n - 1];
        if (btn && !btn.disabled) answer(btn, stage);
      } else if (e.key === 'Enter' && done > 0) {
        step(stage);
      }
    });
  }

  function paint() {
    JPQ.hud.pills([
      { label: '進度', value: state.i + '/' + state.keys.length },
      { label: '答錯', value: state.wrong }
    ]);
    JPQ.hud.progress(state.i / state.keys.length);
  }

  function answer(btn, stage) {
    U.$$('#vbOpts .opt', stage).forEach(b => b.disabled = true);
    const pick = btn.dataset.o;
    const ok = pick === state.rows[state.i].tail;
    const v = state.v;
    const key = state.keys[state.i];

    U.$$('#vbOpts .opt', stage).forEach(b => {
      if (b.dataset.o === state.rows[state.i].tail) b.classList.add('correct');
      else if (b === btn) b.classList.add('wrong');
      else b.classList.add('dim');
    });

    state.answers = state.answers || [];
    state.answers[state.i] = pick;

    if (ok) JPQ.sfx.correct();
    else { state.wrong++; JPQ.sfx.wrong(); }
    JPQ.stats.answer('形:' + key, ok);

    const fb = U.$('#fb', stage);
    fb.className = 'fb show ' + (ok ? 'ok' : 'no');
    const f = verb.form(key);
    fb.innerHTML = `<strong>${ok ? '對了！' : '這裡要接「' + state.rows[state.i].tail + '」'}</strong>
      <p class="vb-answer">${U.ruby(verb.display(v, key))}（${f.label}）</p>
      <p class="vb-tip">${f.hint}</p>
      ${v.note ? `<p class="vb-note">${v.note}</p>` : ''}`;

    U.$('#nextRow', stage).style.display = 'flex';
    U.$('#nextBtn', stage).focus();
    paint();
  }

  function step(stage) {
    state.i++;
    if (state.i >= state.keys.length) finish(stage);
    else render(stage);
  }

  function finish(stage) {
    if (unkey) { unkey(); unkey = null; }
    const v = state.v;
    const n = state.keys.length;
    const stars = state.wrong === 0 ? 3 : (state.wrong <= 2 ? 2 : 1);
    const recKey = 'verb-scramble-' + v.kana;

    /* 只有零失誤才算「這個動詞完全解鎖」 */
    if (state.wrong === 0) JPQ.store.setRecord(recKey, 1);
    JPQ.stats.run('verb-scramble', n, n - state.wrong);

    /* 最後讓整張表完整顯示出來 */
    const rows = state.keys.map((k, i) => {
      const f = verb.form(k);
      return `<tr class="vb-row done">
        <th>${f.label}</th>
        <td class="vb-head">${state.rows[i].head}</td>
        <td class="vb-tail">${state.rows[i].tail}</td>
        <td class="vb-full">${U.ruby(verb.display(v, k))}</td>
      </tr>`;
    }).join('');

    stage.innerHTML = `<div class="panel">
      <div class="q-sentence center">
        <span class="vb-word">${U.ruby(verb.display(v, 'base'))}</span>
        <span class="vb-zh">${v.zh}</span>
      </div>
      <div class="result-stars">${U.stars(stars)}</div>
      <table class="vb-table"><tbody>${rows}</tbody></table>
      <div class="result-row">
        <div>答對<b>${n - state.wrong}</b></div>
        <div>答錯<b>${state.wrong}</b></div>
        <div>本輪星星<b>${stars} / 3</b></div>
      </div>
      ${v.note ? `<p class="vb-note center">${v.note}</p>` : ''}
      <div class="btn-row">
        <button class="btn" id="againBtn">再拼一個動詞</button>
        <button class="btn grey" id="backBtn">回主頁</button>
      </div>
    </div>`;

    JPQ.hud.set('拼圖完成', U.ruby(verb.display(v, 'base')) + ' · ' + v.zh);
    JPQ.hud.progress(1);
    JPQ.hud.pills([{ label: '星星', value: '⭐'.repeat(stars) }]);
    if (stars === 3) { JPQ.sfx.levelup(); JPQ.fx.center(); }
    JPQ.speech.say(v.kana);

    U.$('#againBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); start(stage); });
    U.$('#backBtn', stage).addEventListener('click', () => { JPQ.sfx.click(); JPQ.go('#/'); });
  }

  JPQ.registerGame({
    name: 'verb-scramble',
    title: '活用表拼圖',
    sub: '詞尾自己挑，拼出整張表',
    card: {
      thumb: 'tiles',
      icon: '🧩',
      color: '#8fd6b8',
      title: '活用表拼圖',
      desc: '詞幹給你、詞尾自己挑。走完一輪整列活用表就會拼好，最看得出五段每個段差在哪。',
      tag: '8 格'
    },
    best: () => {
      const done = verb.VERBS.filter(v => JPQ.store.record('verb-scramble-' + v.kana) > 0);
      return done.length ? `${done.length} / ${verb.VERBS.length} 個動詞` : '';
    },
    mount(stage) { intro(stage); },
    unmount() {
      if (unkey) { unkey(); unkey = null; }
      JPQ.speech.stop();
    }
  });

})(window);
