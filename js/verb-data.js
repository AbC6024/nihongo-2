/* =========================================================
   動詞活用 — 規則引擎 + 動詞資料
   ------------------------------------------------------------
   教科書上那張「活用表」其實只有兩條路：

     未然形  →  ない ／ う・よう ／ れる・られる ／ せる・させる
     連用形  →  て ／ た ／ ます ／ ません

   一段與サ変・カ変只有一列，規則很單純；
   五段才會「跳行」，而跳法完全由最後一個假名（段）決定。

   所以這裡把五段寫成「行 × 段」的一張小表，
   書・帰・知・死・話・泳・待・飲・飛・讀・買 … 全部由同一組規則算出，
   不必一個一個背。

   音便（連用形 → て／た）同樣只看段：

     う・く・す・つ・る  →  て ／ た      買う → 買って
     ぐ・ぬ・ぶ・む      →  で ／ だ      泳ぐ → 泳いで

   ========================================================= */
(function (global) {
  const JPQ = global.JPQ = global.JPQ || {};

  /* 五段意志形使用お段未然形＋う；否定使用あ段未然形＋ない。 */
  const GODAN = {
    'う': { mizen:'わ', ren:'い', tai:'う', kate:'え', meirei:'え', you:'おう' },
    'く': { mizen:'か', ren:'き', tai:'く', kate:'け', meirei:'け', you:'こう' },
    'ぐ': { mizen:'が', ren:'ぎ', tai:'ぐ', kate:'げ', meirei:'げ', you:'ごう' },
    'す': { mizen:'さ', ren:'し', tai:'す', kate:'せ', meirei:'せ', you:'そう' },
    'つ': { mizen:'た', ren:'ち', tai:'つ', kate:'て', meirei:'て', you:'とう' },
    'ぬ': { mizen:'な', ren:'に', tai:'ぬ', kate:'ね', meirei:'ね', you:'のう' },
    'ぶ': { mizen:'ば', ren:'び', tai:'ぶ', kate:'べ', meirei:'べ', you:'ぼう' },
    'む': { mizen:'ま', ren:'み', tai:'む', kate:'め', meirei:'め', you:'もう' },
    'る': { mizen:'ら', ren:'り', tai:'る', kate:'れ', meirei:'れ', you:'ろう' }
  };

  /* 連用形 → て／た：音便之後的連用形，以及要接上去的字。

     這裡最容易搞錯的是三個段：
       く段  書き → いて   （き 變 い）   書いて
       ぐ段  泳ぎ → いで   （ぎ 變 い）   泳いで
       る段  知り → って   （り 變 っ）   知って
     買う → 買って；書く → 書いて，兩者的音便不同。          */
  const REN_TE = {
    'う': { ren:'っ', suf:'て', tafu:'た' },   /* 買い → っ＋て */
    'く': { ren:'い', suf:'て', tafu:'た' },   /* 書き → い＋て */
    'ぐ': { ren:'い', suf:'で', tafu:'だ' },   /* 泳ぎ → い＋で */
    'す': { ren:'し', suf:'て', tafu:'た' },
    'つ': { ren:'っ', suf:'て', tafu:'た' },
    'ぬ': { ren:'ん', suf:'で', tafu:'だ' },
    'ぶ': { ren:'ん', suf:'で', tafu:'だ' },
    'む': { ren:'ん', suf:'で', tafu:'だ' },
    'る': { ren:'っ', suf:'て', tafu:'た' }    /* 知り → っ＋て */
  };

  /* 音便說明，答錯時拿來講解 */
  const OMPU = {
    'う': 'い 變 っ → て／た',
    'く': 'き 變 い → て／た',
    'ぐ': 'ぎ 變 い → で／だ',
    'す': 'し段 → て／た',
    'つ': 'ち 變 っ → て／た',
    'ぬ': 'に 變 ん → で／だ',
    'ぶ': 'び 變 ん → で／だ',
    'む': 'み 變 ん → で／だ',
    'る': 'り 變 っ → て／た'
  };

  /* 少數不照規則走的動詞。值直接寫整個假名形式。

     動詞類別不能只看假名判斷：
     切る → 切って，但 着る → 着て，兩者讀音都是 きる。
     這種只能一個一個記下來，所以要在資料裡自己標。 */
  const EXCEPTION = {
    /* 行く 的 く段 連用形 本來變 い，因為 促音便 再變 っ：行いて → 行って */
    'いく': { te:'いって', ta:'いった',
              why:'行く 的 く段 連用形 是 いき，但 て形 因為 促音便 是 いって，不是 いいて' },
    /* ある 的否定特殊；あり、あって、あろう仍照五段規則。 */
    'ある': { nai:'ない',
              why:'ある 的否定是 ない；連用形 あり、て形 あって仍遵循五段規則' }
  };

  /* 可能・受身・使役：接尾方式依活用種類不同。

     五段的「可能」接在 仮定形 後面（書け＋る→書ける），
     「受身」「使役」才接在 未然形 後面（書か＋れる→書かれる、書か＋せる→書かせる）。
     接在同一個地方會把 可能形 變成 かかる、書かかれる 這種錯字。 */
  const APPLIED = {
    godan:   { from:'mizen', dekitaFrom:'kateStem', dekita:'る',
               ukerare:'れる', saseru:'せる' },
    ichidan: { from:'stem',  dekitaFrom:'stem',    dekita:'られる',
               ukerare:'られる', saseru:'させる' },
    suru:    { from:'prefix',dekitaFrom:'prefix',  dekita:'できる',
               ukerare:'される', saseru:'させる' },
    kuru:    { from:'mizen', dekitaFrom:'mizen',   dekita:'られる',
               ukerare:'られる', saseru:'させる' }
  };

  /* 五段接 て／た 的音便說明，答錯時拿來講解 */

  /* ---------------- 動詞資料 ----------------
     ruby : 漢字＋注音，寫在假名形式的最前面（純假名動詞用 ''）
     kana : 辞書形的假名
     type : godan（五段）｜ ichidan（一段）｜ suru（サ変）｜ kuru（カ変）
     row  : 五段動詞的「行」
     col  : 五段動詞的「段」（即 kana 最後一個假名）
     zh   : 中文意思
     skip : 這個動詞「不成立」的活用形（語言上的特例，不能機械地變）
     note : 為什麼要 skip，答題時拿來說明                          */
  const VERBS = [
    /* ---- 五段：く段 ---- */
    { ruby:'書[か]', kana:'かく',     type:'godan', row:'か', col:'く', zh:'寫' },
    { ruby:'読[よ]', kana:'よむ',     type:'godan', row:'よ', col:'む', zh:'讀' },
    { ruby:'飲[の]', kana:'のむ',     type:'godan', row:'の', col:'む', zh:'喝' },
    /* ---- 五段：ぐ段 ---- */
    { ruby:'泳[およ]', kana:'およぐ', type:'godan', row:'およ', col:'ぐ', zh:'游泳' },
    /* ---- 五段：す段 ---- */
    { ruby:'話[はな]', kana:'はなす', type:'godan', row:'はな', col:'す', zh:'說話' },
    /* ---- 五段：つ段 ---- */
    { ruby:'待[ま]', kana:'まつ',     type:'godan', row:'ま', col:'つ', zh:'等待' },
    { ruby:'立[た]', kana:'たつ',     type:'godan', row:'た', col:'つ', zh:'站立' },
    { ruby:'持[も]', kana:'もつ',     type:'godan', row:'も', col:'つ', zh:'持有' },
    /* ---- 五段：ぬ段 ---- */
    { ruby:'死[し]', kana:'しぬ',     type:'godan', row:'し', col:'ぬ', zh:'死' },
    /* ---- 五段：ぶ段 ---- */
    { ruby:'飛[と]', kana:'とぶ',     type:'godan', row:'と', col:'ぶ', zh:'飛' },
    { ruby:'遊[あそ]', kana:'あそぶ', type:'godan', row:'あそ', col:'ぶ', zh:'玩' },
    { ruby:'呼[よ]', kana:'よぶ',     type:'godan', row:'よ', col:'ぶ', zh:'呼喚' },
    /* ---- 五段：む段 ---- */
    { ruby:'進[すす]', kana:'すすむ', type:'godan', row:'すす', col:'む', zh:'前進' },
    /* ---- 五段：る段 ---- */
    { ruby:'帰[かえ]', kana:'かえる', type:'godan', row:'かえ', col:'る', zh:'回去' },
    { ruby:'知[し]', kana:'しる', type:'godan', row:'し', col:'る', zh:'知道',
      skip:['dekita','dekitaimasu'],
      note:'初級教材以 知ることができる 表達「能得知」；しれる 涉及語境，本題庫不出這項可能形' },
    { ruby:'取[と]', kana:'とる', type:'godan', row:'と', col:'る', zh:'拿、取' },
    { ruby:'乗[の]', kana:'のる', type:'godan', row:'の', col:'る', zh:'乘坐' },
    /* ある 在本題庫採用常見的純假名寫法。 */
    { ruby:'', kana:'ある', type:'godan', row:'あ', col:'る', zh:'有、存在',
      skip:['dekita','dekitaimasu','ukerare','ukeraremasen','saseru','sasenai'],
      note:'ある 的否定是 ない；本題庫不出其可能、受身與使役形' },
    { ruby:'作[つく]', kana:'つくる', type:'godan', row:'つく', col:'る', zh:'做、製造' },
    /* ---- 五段：う段 ---- */
    { ruby:'買[か]', kana:'かう',     type:'godan', row:'か', col:'う', zh:'買' },
    { ruby:'使[つか]', kana:'つかう', type:'godan', row:'つか', col:'う', zh:'使用' },
    { ruby:'洗[あら]', kana:'あらう', type:'godan', row:'あら', col:'う', zh:'洗' },
    { ruby:'習[なら]', kana:'ならう', type:'godan', row:'なら', col:'う', zh:'學、練習' },
    { ruby:'行[い]', kana:'いく',     type:'godan', row:'い', col:'く', zh:'去、走' },

    /* ---- 一段 ---- */
    { ruby:'食[た]', kana:'たべる',   type:'ichidan', zh:'吃' },
    { ruby:'見[み]', kana:'みる',     type:'ichidan', zh:'看' },
    { ruby:'寝[ね]', kana:'ねる',     type:'ichidan', zh:'睡覺' },
    { ruby:'教[おし]', kana:'おしえる', type:'ichidan', zh:'教' },
    { ruby:'覚[おぼ]', kana:'おぼえる', type:'ichidan', zh:'記住、學會' },
    { ruby:'始[はじ]', kana:'はじめる', type:'ichidan', zh:'開始' },
    { ruby:'生[い]', kana:'いきる',   type:'ichidan', zh:'活、生存' },
    { ruby:'忘[わす]', kana:'わすれる', type:'ichidan', zh:'忘記' },
    { ruby:'開[あ]', kana:'あける',   type:'ichidan', zh:'打開' },
    { ruby:'着[き]', kana:'きる',     type:'ichidan', zh:'穿（衣服）' },
    { ruby:'起[お]', kana:'おきる',   type:'ichidan', zh:'起床、起來' },

    /* ---- サ変 ---- */
    { ruby:'',        kana:'する',              type:'suru', zh:'做' },
    { ruby:'勉強[べんきょう]', kana:'べんきょうする', type:'suru', zh:'學習' },
    { ruby:'旅行[りょこう]', kana:'りょこうする', type:'suru', zh:'旅行' },

    /* ---- カ変 ---- */
    /* 來る 的讀音在 来ない(こ) 和 来て(き) 不同，所以這裡 ruby 不標讀音。
       遊戲中漢字與假名會分開顯示，讀音看假名那一行就好。 */
    { ruby:'来', kana:'くる', type:'kuru', zh:'來' }
  ];

  /* ---------------- 活用形一覽 ----------------
     key   程式用的識別碼
     label 中文名稱
     en    英文
     group 分組，之後拿來設計關卡
     hint  一句話說明怎麼變                                    */
  const FORMS = [
    { key:'base',  label:'辞書形',   en:'Dictionary',   group:'base', hint:'動詞的原形，其他形式都從這裡推' },

    { key:'te',    label:'て形',     en:'Te-form',      group:'te',   hint:'連用形；五段要再經過音便' },
    { key:'ta',    label:'た形',     en:'Ta-form',      group:'te',   hint:'連用形 + た；與て形同一條規則' },
    { key:'tai',   label:'連体形',   en:'Adnominal',    group:'base', hint:'修飾名詞用；現代日語動詞的連体形與辞書形相同' },

    { key:'masu',      label:'ます',         en:'Polite',        group:'masu', hint:'連用形 + ます' },
    { key:'masen',     label:'ません',       en:'Polite neg',    group:'masu', hint:'連用形 + ません' },
    { key:'mashita',   label:'ました',       en:'Polite past',   group:'masu', hint:'連用形 + ました' },
    { key:'masendeshita', label:'ませんでした', en:'Polite past neg', group:'masu', hint:'連用形 + ませんでした' },
    { key:'mashimashou', label:'ましょう',    en:"Let's",         group:'masu', hint:'連用形 + ましょう' },
    { key:'masenka',   label:'ませんか',     en:'Question',      group:'masu', hint:'連用形 + ませんか' },

    { key:'nai',    label:'ない',       en:'Negative',     group:'sent', hint:'未然形 + ない' },
    { key:'darou',  label:'だろう',     en:'Presumptive',  group:'sent', hint:'辞書形 + だろう' },
    { key:'you',    label:'意志形',     en:'Volitional',   group:'sent', hint:'五段：詞尾變お段 + う；一段：去る + よう；する→しよう；来る→こよう' },
    { key:'meirei', label:'命令形',     en:'Imperative',   group:'sent', hint:'直接叫人做：書け／食べろ' },
    { key:'kinshi', label:'禁止形',     en:'Prohibition',  group:'sent', hint:'辞書形 + な：するな' },
    { key:'kate',   label:'条件形・ば', en:'Conditional',  group:'sent', hint:'書けば／食べれば' },

    { key:'dekita',        label:'可能形',       en:'Potential',      group:'applied', hint:'能…：書ける／食べられる' },
    { key:'dekitaimasu',  label:'可能形・ます', en:'Potential form', group:'applied', hint:'書けます' },
    { key:'ukerare',      label:'受身形',       en:'Passive',        group:'applied', hint:'被…：書かれる／食べられる' },
    { key:'ukeraremasen', label:'受身・ません', en:'Passive neg',    group:'applied', hint:'書かれません' },
    { key:'saseru',       label:'使役形',       en:'Causative',      group:'applied', hint:'讓…：書かせる／食べさせる' },
    { key:'sasenai',      label:'使役・ない',   en:'Causative neg',  group:'applied', hint:'書かせない／食べさせない' }
  ];

  /* ---------------- 工具 ---------------- */

  /* 取出 ruby 字串裡的假名：書[か] → か，勉強[べんきょう] → べんきょう */
  function rubyKana(text) {
    let out = '';
    String(text || '').replace(/\[([^\]]+)\]/g, function (_, k) { out += k; return _; });
    return out;
  }

  /* ruby 有幾個假名被漢字蓋住。沒有標注音的（來）就用字數算。 */
  function coverLen(verb) {
    if (!verb.ruby) return 0;
    const kana = rubyKana(verb.ruby);
    return kana ? kana.length : String(verb.ruby).length;
  }

  /* ---------------- 規則引擎 ---------------- */

  /* 展開成 6 個活用形詞幹 */
  function stems(v) {
    const k = v.kana;

    if (v.type === 'godan') {
      const g = GODAN[v.col];
      const rt = REN_TE[v.col];
      const stem = k.slice(0, -1);
      const ren = stem + g.ren;
      const ex = EXCEPTION[k] || {};
      return {
        stem: stem, base: k, type: 'godan',
        mizen:  ex.mizen  || stem + g.mizen,
        ren:    ex.ren    || ren,
        tai:    stem + g.tai,
        kateStem: stem + g.kate,
        kate:   stem + g.kate + 'ば',
        meirei: stem + g.meirei,
        you:    stem + g.you,
        te: ex.te || stem + rt.ren + rt.suf,
        ta: ex.ta || stem + rt.ren + rt.tafu
      };
    }

    if (v.type === 'suru') {
      /* する → し、する → せ，都是整個換掉「する」兩個字 */
      const prefix = k.slice(0, -2);
      const stem = prefix + 'し';
      return {
        stem: stem, base: k, type: 'suru', prefix: prefix,
        mizen: stem, ren: stem, tai: k,
        kate: prefix + 'すれば',
        meirei: prefix + 'しろ',
        you: stem + 'よう',
        te: stem + 'て', ta: stem + 'た'
      };
    }

    if (v.type === 'kuru') {
      const prefix = k.slice(0, -2);
      const mizen = prefix + 'こ';   /* 来ない */
      const ren = prefix + 'き';     /* 来て */
      return {
        stem: mizen, base: k, type: 'kuru', prefix: prefix,
        mizen: mizen, ren: ren, tai: k,
        kate: prefix + 'くれば',
        meirei: prefix + 'こい',
        you: mizen + 'よう',
        te: ren + 'て', ta: ren + 'た'
      };
    }

    /* 一段：去掉る後接詞尾。 */
    const stem = k.slice(0, -1);
    const ex = EXCEPTION[k] || {};
    return {
      stem: stem, base: k, type: 'ichidan',
      mizen: stem, ren: stem, tai: k,
      kateStem: stem,
      kate: stem + 'れば',
      meirei: stem + 'ろ',
      you: stem + 'よう',
      te: ex.te || stem + 'て',
      ta: ex.ta || stem + 'た'
    };
  }

  /* 展開一個動詞的所有活用形 → { key: 'かかない', ... } */
  function all(v) {
    const s = stems(v);
    const ap = APPLIED[s.type];
    const appliedBase = s[ap.from];
    const dekita = s[ap.dekitaFrom] + ap.dekita;
    const ukerare = appliedBase + ap.ukerare;

    /* 否定形：未然形＋ない；ある 特殊，直接變成ない。 */
    const nai = (EXCEPTION[v.kana] || {}).nai || s.mizen + 'ない';

    return {
      base:   s.base,
      tai:    s.tai,
      te:     s.te,
      ta:     s.ta,
      kate:   s.kate,
      meirei: s.meirei,

      nai:    nai,
      darou:  s.base + 'だろう',
      you:    s.you,
      kinshi: s.base + 'な',

      masu:          s.ren + 'ます',
      masen:         s.ren + 'ません',
      mashita:       s.ren + 'ました',
      masendeshita:  s.ren + 'ませんでした',
      mashimashou:   s.ren + 'ましょう',
      masenka:       s.ren + 'ませんか',

      dekita:        dekita,
      /* 可能形の連用形接 ます：書ける → 書けます、できる → できます */
      dekitaimasu:   dekita.slice(0, -1) + 'ます',
      ukerare:       ukerare,
      ukeraremasen:  ukerare.slice(0, -1) + 'ません',
      saseru:        appliedBase + ap.saseru,
      sasenai:       (appliedBase + ap.saseru).slice(0, -1) + 'ない'
    };
  }

  const verb = JPQ.verb = {

    FORMS: FORMS,
    VERBS: VERBS,
    TYPE_NAME: { godan:'五段', ichidan:'一段', suru:'サ変', kuru:'カ変' },

    /* ---------------- 查表用的資料 ----------------
       速查表上那幾張表也是從同一組規則生出來的，
       免得「表格寫的」和「題目算的」變成兩套東西。 */

    /* 五段活用表：9 個段 × 6 個活用形 */
    GODAN_COLS: [
      { key: 'mizen',  label: '未然形（あ段）',  note: 'ない／れる／せる；意志形另用お段＋う' },
      { key: 'ren',    label: '連用形',  note: 'て・た／ます・ません' },
      { key: 'tai',    label: '連体形',  note: '和辞書形一樣' },
      { key: 'kate',   label: '仮定形＋ば',  note: 'え段＋ば' },
      { key: 'meirei', label: '命令形',  note: '直接叫人做' },
      { key: 'you',    label: '意志形',  note: '…う（五段）／…よう（其他）' }
    ],
    GODAN_ORDER: ['う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'る'],
    /* 每個段配一個代表動詞，讓表格看得出來 */
    GODAN_SAMPLE: {
      'う': 'かう', 'く': 'かく', 'ぐ': 'およぐ', 'す': 'はなす', 'つ': 'まつ',
      'ぬ': 'しぬ', 'ぶ': 'とぶ', 'む': 'よむ', 'る': 'しる'
    },

    /* 音便表：連用形 → て／た。change 是「要變的那個假名」。 */
    ompuGrid: function () {
      const out = [];
      verb.GODAN_ORDER.forEach(col => {
        const v = verb.byKana(verb.GODAN_SAMPLE[col]);
        if (!v) return;
        const s = verb._internals.stems(v);
        const rt = REN_TE[col];
        const ex = EXCEPTION[v.kana] || {};
        out.push({
          col: col,
          verb: v,
          ren: s.ren,
          teRen: ex.te ? ex.te.slice(v.row.length) : rt.ren,
          teSuf: ex.te ? '' : rt.suf,
          taRen: ex.ta ? ex.ta.slice(v.row.length) : rt.ren,
          taSuf: ex.ta ? '' : rt.tafu,
          rule: OMPU[col],
          note: ex.why || ''
        });
      });
      return out;
    },

    /* 一段・サ変・カ変：三種都只有一列，規則很單純 */
    OTHER_TYPES: [
      { type: 'ichidan', kana: 'たべる', forms: [
        { key: 'te', label: 'て形' }, { key: 'ta', label: 'た形' },
        { key: 'nai', label: 'ない' }, { key: 'you', label: '意志形' },
        { key: 'masu', label: 'ます' }, { key: 'meirei', label: '命令形' },
        { key: 'kate', label: '…ば' }
      ], note: '去掉る後接詞尾：食べて・食べない・食べよう。作る屬於五段' },
      { type: 'suru', kana: 'べんきょうする', forms: [
        { key: 'te', label: 'て形' }, { key: 'ta', label: 'た形' },
        { key: 'nai', label: 'ない' }, { key: 'you', label: '意志形' },
        { key: 'masu', label: 'ます' }, { key: 'meirei', label: '命令形' },
        { key: 'kate', label: '…ば' }, { key: 'dekita', label: 'できる' }
      ], note: 'する 整個換成 し／せ：勉強して・しない・しよう・しろ' },
      { type: 'kuru', kana: 'くる', forms: [
        { key: 'te', label: 'て形' }, { key: 'ta', label: 'た形' },
        { key: 'nai', label: 'ない' }, { key: 'you', label: '意志形' },
        { key: 'masu', label: 'ます' }, { key: 'meirei', label: '命令形' },
        { key: 'kate', label: '…ば' }
      ], note: '未然形用 こ、連用形用 き：こない・きて，兩者讀音不同' }
    ],

    byKana: function (kana) {
      for (let i = 0; i < VERBS.length; i++) if (VERBS[i].kana === kana) return VERBS[i];
      return null;
    },
    byType: function (type) { return VERBS.filter(v => v.type === type); },
    form: function (key) {
      for (let i = 0; i < FORMS.length; i++) if (FORMS[i].key === key) return FORMS[i];
      return null;
    },

    /* 依題庫範圍排除不適合初級機械變化練習的形式。 */
    supports: function (v, key) {
      const f = verb.form(key);
      if (!f) return false;
      if (f.scope === 'godan' && v.type !== 'godan') return false;
      if (v.skip && v.skip.indexOf(key) !== -1) return false;
      return true;
    },

    /* 這個動詞實際擁有的活用形清單 */
    formsFor: function (v) {
      return FORMS.filter(f => verb.supports(v, f.key));
    },

    /* 產生假名形式的某個活用形 */
    conjugate: function (v, key) {
      if (!verb.supports(v, key)) return '';
      return all(v)[key] || '';
    },

    /* 漢字＋注音的顯示形式，例如 かかない → 書[か]ない。
       一般的做法是 ruby + kana 去掉被漢字蓋住的那幾個字，
       但少數活用形會把詞幹整個換掉（ある → ない），
       那種情況下 ruby 不再對應任何假名，要用 displayFix 直接指定。 */
    display: function (v, key) {
      const kana = verb.conjugate(v, key);
      if (!kana) return '';
      if (v.displayFix && v.displayFix[key]) return v.displayFix[key];
      if (!v.ruby) return kana;
      return v.ruby + kana.slice(coverLen(v));
    },

    /* 把某個活用形拆成「不變的部分 + 要挑的詞尾」。
       拼圖玩法讓玩家只挑詞尾，這樣才看得出規則長什麼形狀。 */
    split: function (v, key) {
      const s = stems(v);
      const a = all(v);
      const kana = a[key];
      if (!kana) return null;

      const godan = v.type === 'godan';
      const g = godan ? GODAN[v.col] : null;
      const rt = godan ? REN_TE[v.col] : null;
      const ap = APPLIED[s.type];
      const apBase = s[ap.from];
      const dekitaBase = s[ap.dekitaFrom];
      const dekita = dekitaBase + ap.dekita;
      const ukerare = apBase + ap.ukerare;
      const saseru = apBase + ap.saseru;

      let head = '', tail = '';
      switch (key) {
        case 'base':
        case 'tai':
          head = kana; break;

        /* て／た：五段要把音便整包丟給玩家猜，例外的動詞則照實際結果切 */
        case 'te':
        case 'ta':
          if (godan) {
            head = s.stem;
            tail = kana.slice(head.length);
          } else {
            head = s.ren;
            tail = kana.slice(s.ren.length);
          }
          break;

        case 'masu':           head = s.ren; tail = 'ます'; break;
        case 'masen':          head = s.ren; tail = 'ません'; break;
        case 'mashita':        head = s.ren; tail = 'ました'; break;
        case 'masendeshita':   head = s.ren; tail = 'ませんでした'; break;
        case 'mashimashou':    head = s.ren; tail = 'ましょう'; break;
        case 'masenka':        head = s.ren; tail = 'ませんか'; break;

        case 'nai':
          head = v.kana === 'ある' ? '' : s.mizen; tail = kana.slice(head.length); break;

        case 'darou':          head = s.base; tail = 'だろう'; break;
        case 'kinshi':         head = s.base; tail = 'な'; break;
        case 'you':            head = godan ? s.you.slice(0, -1) : s.mizen; tail = godan ? 'う' : 'よう'; break;
        case 'meirei':         head = godan || v.type === 'ichidan' ? s.stem : s.prefix; tail = kana.slice(head.length); break;
        case 'kate':           head = s.kate.slice(0, -1); tail = 'ば'; break;

        case 'dekita':         head = dekitaBase; tail = ap.dekita; break;
        case 'ukerare':        head = apBase; tail = ap.ukerare; break;
        case 'saseru':         head = apBase; tail = ap.saseru; break;

        case 'dekitaimasu':
          head = dekita.slice(0, -1); tail = 'ます'; break;
        case 'ukeraremasen':
          head = ukerare.slice(0, -1); tail = 'ません'; break;
        case 'sasenai':
          head = saseru.slice(0, -1); tail = 'ない'; break;

        default: break;
      }

      /* 保險：切錯了就整個當成詞尾，至少不會顯示出矛盾的東西 */
      if (head + tail !== kana) { head = ''; tail = kana; }
      return { head: head, tail: tail, kana: kana };
    },

    /* 把整張活用表攤開：[{ key, label, en, kana, display, hint }] */
    table: function (v) {
      const a = all(v);
      return verb.formsFor(v).map(f => {
        const sp = verb.split(v, f.key);
        return {
          key: f.key, label: f.label, en: f.en, group: f.group, hint: f.hint,
          kana: a[f.key] || '',
          head: sp ? sp.head : '',
          tail: sp ? sp.tail : '',
          display: verb.display(v, f.key)
        };
      });
    },

    /* 這題為什麼是這個答案：把規則攤開講 */
    explain: function (v, key) {
      const s = stems(v);
      const a = all(v);
      const out = { parts: [], tip: '', note: '' };
      if (!verb.supports(v, key)) return out;
      const sp = verb.split(v, key);
      if (key === 'te' || key === 'ta') {
        out.parts.push({ label:'連用形', kana:s.ren });
        if (v.type === 'godan') out.parts.push({ label:'音便', kana:OMPU[v.col] });
        out.note = (EXCEPTION[v.kana] || {}).why || '';
      } else if (sp.head) {
        const label = key === 'you' ? '未然形（意志）' : key === 'nai' ? '未然形' : '接續部分';
        out.parts.push({ label:label, kana:sp.head });
        if (sp.tail) out.parts.push({ label:'接上', kana:sp.tail });
      }
      out.parts.push({ label:verb.form(key).label, kana:a[key] });
      if (v.kana === 'ある' && key === 'nai') out.note = EXCEPTION['ある'].why;
      return out;
    }
  };

  /* 給測試用 */
  verb._internals = { GODAN: GODAN, REN_TE: REN_TE, OMPU: OMPU, EXCEPTION: EXCEPTION,
                       stems: stems, all: all, rubyKana: rubyKana, coverLen: coverLen };

})(window);
