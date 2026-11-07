/* =========================================================
   遊戲目錄：整站有哪些遊戲
   status: 'live' 已上線 ／ 'soon' 開發中
    thumb: 用於產生縮圖的樣式（'quiz' | 'speed' | 'tiles' | 'link' | 'kana' | 'cards' | 'clock' | 'listen' | 'verb'）
   ========================================================= */
window.JPQ = window.JPQ || {};

JPQ.CATALOG = [
  {
    slug: 'particles',
    status: 'live',
    thumb: 'link',
    title: '助詞',
    titleEn: 'Particles',
    href: 'particles.html',
    desc: '看句子填空，選出正確的 は・が・の・を・に・で・と・も。',
    detail: ['6 關闖關', '45 秒搶答', '24 句重排', '24 組配對']
  },
  {
    slug: 'gojuon',
    status: 'live',
    thumb: 'kana',
    title: '五十音',
    titleEn: 'Kana Quest',
    href: 'gojuon.html',
    desc: '先平假名、再片假名。從選音、辨字、聽音與配對開始，再挑戰翻牌記憶和句子填空。',
    detail: ['六種玩法', '先平假名後片假名', '翻牌與填空', '完整五十音表']
  },
  {
    slug: 'conjugation',
    status: 'live',
    thumb: 'verb',
    title: '動詞',
    titleEn: 'Verbs',
    href: 'conjugation.html',
    desc: '從台灣版《大家的日本語》初級Ⅰ、Ⅱ第 1～25 課的動詞隨機抽題，可選冊別與變化，附中文說明。',
    detail: ['每次 10 題', '動詞不重複', '混合或指定變化', '初級Ⅰ・Ⅱ字彙']
  },
  {
    slug: 'listening',
    status: 'live',
    thumb: 'listen',
    title: '聽打',
    titleEn: 'Kii Board',
    href: 'listening/',
    desc: '聞いボード：依《大家的日本語》第 1～12 課選字練習聽打，搭配錯題複習與個人學習紀錄。',
    detail: ['第 1～12 課', '單字聽打', '錯題複習', '個人學習紀錄']
  },
  {
    slug: 'katakana-words', status: 'live', thumb: 'kana',
    title: '片假名單字', titleEn: 'Katakana Words', href: 'katakana_game.html',
    desc: '從《大家的日本語》第 1～12 課片假名單字練習中文意思與日文對應，可選課次或混合出題。',
    detail: ['每輪 10 題', '三種出題模式', '第 1～12 課', '單字發音']
  },
  {
    slug: 'n5-reading', status: 'live', thumb: 'quiz',
    title: '閱讀', titleEn: 'N5 Reading', href: 'n5_reading_game.html',
    desc: '閱讀日常生活短文，找出句子中的關鍵資訊，答後附中文翻譯與解說。',
    detail: ['20 篇短文', '每輪 10 題', '中文翻譯', '答案解說']
  }
];

// The same six categories drive the home cards, header and footer.
const categoryOrder = ['gojuon', 'particles', 'katakana-words', 'listening', 'conjugation', 'n5-reading'];
JPQ.CATALOG.sort((a, b) => categoryOrder.indexOf(a.slug) - categoryOrder.indexOf(b.slug));
