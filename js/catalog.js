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
    desc: '看字選音、看音選字、聽音辨識、配對記憶，四種玩法都能切換平假名、片假名與 N5 單字。',
    detail: ['四種玩法', '三種字集', '記憶配對', '完整五十音表']
  },
  {
    slug: 'conjugation',
    status: 'live',
    thumb: 'verb',
    title: '動詞活用',
    titleEn: 'Verbs',
    href: 'conjugation.html',
    desc: '適合初級Ⅰ、Ⅱ。從ます形開始，每次只練一種變化，附簡單中文說明。',
    detail: ['每次 6 題', '不限時間', '基礎變化', '初級Ⅱ變化']
  },
  {
    slug: 'listening',
    status: 'live',
    thumb: 'listen',
    title: '日語聽打',
    titleEn: 'Kii Board',
    href: 'listening/',
    desc: '聞いボード：聽日文、打出答案，從 N5 到 N1 練習單字與句子，搭配錯題複習和每日挑戰。',
    detail: ['N5～N1', '單字與句子', '錯題複習', '每日挑戰']
  },
  {
    slug: 'hiragana',
    status: 'live',
    thumb: 'cards',
    title: '五十音大冒險',
    titleEn: 'Hiragana Adventure',
    href: 'hiragana/',
    desc: '先認字連連看，再挑戰翻牌記憶，最後用平假名與羅馬字完成句子填空，循序練熟基礎五十音。',
    detail: ['6 關連連看', '5 種翻牌網格', '15 題句子填空', '日語朗讀']
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
