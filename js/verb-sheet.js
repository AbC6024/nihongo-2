/* =========================================================
   動詞活用 — 速查表
   ------------------------------------------------------------
   三張表都從 verb-data.js 的同一組規則算出來，
   所以不會出現「表上寫的」和「遊戲出題的」變成兩套東西。
   ========================================================= */
(function (global) {
  const JPQ = global.JPQ, U = JPQ.util;
  const verb = JPQ.verb;

  const TYPE_COLOR = {
    godan: '#f5a9c0', ichidan: '#8fd6b8', suru: '#f7c98d', kuru: '#b3a4ef'
  };

  /* ---------- 五段活用表 ---------- */
  function godanTable() {
    const st = verb._internals.stems;
    const head = `<tr><th>段</th>` + verb.GODAN_COLS.map(c =>
      `<th>${c.label}<em>${c.note}</em></th>`).join('') + `<th>例</th></tr>`;

    const rows = verb.GODAN_ORDER.map(col => {
      const v = verb.byKana(verb.GODAN_SAMPLE[col]);
      const s = st(v);
      const cells = verb.GODAN_COLS.map(c => `<td>${U.ruby(v.ruby)}${s[c.key].slice(v.row.length)}</td>`).join('');
      return `<tr>
        <th class="vb-col">${col}段</th>${cells}
        <td class="vb-ex">${U.ruby(verb.display(v, 'base'))}<em>${v.zh}</em></td>
      </tr>`;
    }).join('');

    return `<div class="vb-scroll"><table class="vb-grid">
      <caption>五段動詞 — 最後一個假名（段）決定詞尾怎麼變</caption>
      <thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  }

  /* ---------- 音便表 ---------- */
  function ompuTable() {
    const rows = verb.ompuGrid().map(r => {
      const head = r.verb.kana.slice(0, r.verb.row.length);
      const teKana = head + r.teRen + r.teSuf;
      const taKana = head + r.taRen + r.taSuf;
      return `<tr>
        <th class="vb-col">${r.col}段</th>
        <td class="vb-ex">${U.ruby(verb.display(r.verb, 'base'))}<em>${r.verb.zh}</em></td>
        <td>${head}${r.ren.slice(r.verb.row.length)}</td>
        <td class="vb-arrow-cell">→</td>
        <td><b>${teKana}</b></td>
        <td><b>${taKana}</b></td>
        <td class="vb-rule">${r.rule}${r.note ? `<em>${r.note}</em>` : ''}</td>
      </tr>`;
    }).join('');

    return `<div class="vb-scroll"><table class="vb-grid vb-grid-ompu">
      <caption>音便 — 連用形接「て／た」時的變化。這三行最容易錯：<b>く段</b>（き→い）、<b>ぐ段</b>（ぎ→い→で）、<b>る段</b>（り→っ）</caption>
      <thead><tr><th>段</th><th>例</th><th>連用形</th><th></th><th>て形</th><th>た形</th><th>規則</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  /* ---------- 一段・サ変・カ変 ---------- */
  function otherTable() {
    const blocks = verb.OTHER_TYPES.map(g => {
      const v = verb.byKana(g.kana);
      const cells = g.forms.map(f => {
        const s = verb.split(v, f.key);
        const d = verb.display(v, f.key).replace(/\[([^\]]+)\]/g, '');
        return `<td><em>${f.label}</em><b>${d}</b></td>`;
      }).join('');
      return `<div class="vb-otype" style="--c:${TYPE_COLOR[g.type]}">
        <div class="vb-otype-head">
          <strong>${verb.TYPE_NAME[g.type]}</strong>
          <span>${U.ruby(verb.display(v, 'base'))}（${v.zh}）</span>
        </div>
        <div class="vb-otype-grid">${cells}</div>
        <p class="vb-otype-note">${g.note}</p>
      </div>`;
    }).join('');

    return `<h3 class="vb-h3">一段・サ変・カ変</h3>
      <p class="vb-lede">這三種只有一列，沒有五段那種跳行，規則最單純。
        唯一的坑是「する」和「来る」要用不同的假名。</p>
      ${blocks}`;
  }

  /* ---------- 動詞一覽 + 展開的完整活用表 ---------- */
  function verbList() {
    const groups = ['godan', 'ichidan', 'suru', 'kuru'].map(type => {
      const items = verb.VERBS.filter(v => v.type === type).map(v =>
        `<button class="vb-chip" type="button" data-kana="${v.kana}" style="--c:${TYPE_COLOR[type]}">
          ${U.ruby(verb.display(v, 'base'))}<em>${v.zh}</em>
        </button>`).join('');
      return `<div class="vb-group">
        <h4><span class="vb-dot" style="background:${TYPE_COLOR[type]}"></span>
          ${verb.TYPE_NAME[type]}（${verb.byType(type).length} 個）</h4>
        <div class="vb-chips">${items}</div>
      </div>`;
    }).join('');

    return `<div id="vbList">${groups}</div>
      <div id="vbDetail" class="vb-detail" hidden></div>`;
  }

  /* 展開某個動詞的完整活用表 */
  function showDetail(host, kana) {
    const v = verb.byKana(kana);
    if (!v) return;

    const rows = verb.table(v).map(r => `<tr>
      <th>${r.label}<em>${r.en}</em></th>
      <td>${U.ruby(r.display)}</td>
      <td class="vb-rule">${r.hint}</td>
    </tr>`).join('');

    host.innerHTML = `<div class="vb-detail-head">
        <strong>${U.ruby(verb.display(v, 'base'))}</strong>
        <span class="vb-zh">${v.zh}</span>
        <span class="vb-tag">${verb.TYPE_NAME[v.type]}${v.col ? ' · ' + v.col + '段' : ''}</span>
        <button class="vb-say" type="button" data-say="${v.kana}" title="聽發音">🔊</button>
        <button class="btn grey small" type="button" data-close>收起</button>
      </div>
      ${v.note ? `<p class="vb-note">${v.note}</p>` : ''}
      <div class="vb-scroll"><table class="vb-grid vb-grid-one">
        <tbody>${rows}</tbody></table></div>`;
    host.hidden = false;

    U.$('[data-close]', host).addEventListener('click', () => {
      host.hidden = true;
      U.$$('.vb-chip').forEach(c => c.classList.remove('on'));
    });
    const say = U.$('[data-say]', host);
    if (say) say.addEventListener('click', () => { JPQ.sfx.click(); JPQ.speech.say(say.dataset.say); });
  }

  JPQ.verbSheet = {
    render: function () {
      const box = U.$('#verbSheet');
      if (!box) return;

      box.innerHTML = `
        <h3 class="vb-h3">五段活用表</h3>
        <p class="vb-lede">五段動詞的變化只由最後一個假名決定。
          找出那個假名是什麼段，整列就都推出來了。</p>
        ${godanTable()}
        ${ompuTable()}
        ${otherTable()}
        <h3 class="vb-h3">動詞一覽</h3>
        <p class="vb-lede">點任何一個動詞，看它全部 ${verb.FORMS.length} 種活用形。</p>
        ${verbList()}`;

      U.$$('.vb-chip', box).forEach(chip => chip.addEventListener('click', () => {
        JPQ.sfx.click();
        U.$$('.vb-chip', box).forEach(c => c.classList.remove('on'));
        chip.classList.add('on');
        showDetail(U.$('#vbDetail', box), chip.dataset.kana);
      }));
    }
  };

})(window);
