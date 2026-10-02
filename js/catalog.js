/* =========================================================
   遊戲目錄：整站有哪些遊戲
   status: 'live' 已上線 ／ 'soon' 開發中
   thumb: 用於產生縮圖的樣式（'quiz' | 'speed' | 'tiles' | 'link' | 'kana' | 'cards' | 'clock' | 'listen'）
   ========================================================= */
window.JPQ = window.JPQ || {};

JPQ.CATALOG = [
  {
    slug: 'particles',
    status: 'live',
    thumb: 'link',
    title: '助詞大冒險',
    titleEn: 'Particles',
    href: 'particles.html',
    desc: '看句子填空，選出正確的 は・が・の・を・に・で・と・も。',
    detail: ['6 關闖關', '45 秒搶答', '24 句重排', '24 組配對']
  },
  {
    slug: 'gojuon',
    status: 'live',
    thumb: 'kana',
    title: '五十音圖',
    titleEn: 'Kana Quest',
    href: 'gojuon.html',
    desc: '先玩三種練習記熟五十音，再回頭查那張完整的五十音表。',
    detail: ['順序挑戰', '平片對照', '聽音選字', '完整五十音表']
  },
  {
    slug: 'vocab',
    status: 'soon',
    thumb: 'cards',
    title: '單字閃卡',
    titleEn: 'Vocabulary',
    titleNote: '開發中',
    desc: 'N5 常用單字翻卡練習，記得哪些字還沒背熟。'
  },
  {
    slug: 'numbers',
    status: 'soon',
    thumb: 'clock',
    title: '數字與日期',
    titleEn: 'Numbers',
    titleNote: '開發中',
    desc: '數字、星期、月份和時間的聽說練習。'
  }
];
