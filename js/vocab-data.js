/* =========================================================
   題庫字集：平假名 / 片假名 / 單字
   每筆資料的格式：
     char  題目上顯示的字面
     roman 讀音（羅馬字）
     zh    中文意思（只有單字字集有）
     tag   分類／行別，用在答題後的說明
     speak 給語音合成的假名（讀音依日文慣例用平假名）
   ========================================================= */
window.JPQ = window.JPQ || {};

/* N5 常見單字 */
JPQ.VOCAB = [
  { char: '水', roman: 'mizu', zh: '水', tag: '自然', speak: 'みず' },
  { char: '猫', roman: 'neko', zh: '貓', tag: '動物', speak: 'ねこ' },
  { char: '本', roman: 'hon', zh: '書', tag: '文具', speak: 'ほん' },
  { char: '犬', roman: 'inu', zh: '狗', tag: '動物', speak: 'いぬ' },
  { char: '春', roman: 'haru', zh: '春天', tag: '季節', speak: 'はる' },
  { char: '食べる', roman: 'taberu', zh: '吃', tag: '動詞', speak: 'たべる' },
  { char: '飲む', roman: 'nomu', zh: '喝', tag: '動詞', speak: 'のむ' },
  { char: '友達', roman: 'tomodachi', zh: '朋友', tag: '人', speak: 'ともだち' },
  { char: '学校', roman: 'gakkou', zh: '學校', tag: '地方', speak: 'がっこう' },
  { char: '大きい', roman: 'ookii', zh: '大的', tag: '形容詞', speak: 'おおきい' },
  { char: '赤', roman: 'aka', zh: '紅色', tag: '顏色', speak: 'あか' },
  { char: '青い', roman: 'ao', zh: '藍色', tag: '顏色', speak: 'あおい' },
  { char: '先生', roman: 'sensei', zh: '老師', tag: '人', speak: 'せんせい' },
  { char: '電車', roman: 'densha', zh: '電車', tag: '交通', speak: 'でんしゃ' },
  { char: '空', roman: 'sora', zh: '天空', tag: '自然', speak: 'そら' },
  { char: '山', roman: 'yama', zh: '山', tag: '自然', speak: 'やま' }
];

/* 假名字集直接由 kana-data.js 的清音 46 音展開，免得兩邊各維護一份 */
(function (global) {
  const kana = global.JPQ.kana.list();

  const toItem = (char, k) => ({
    char: char, roman: k.romaji, zh: '', tag: k.row, speak: k.hira
  });

  global.JPQ.kanaPool = {
    hiragana: { label: '平假名', items: kana.map(k => toItem(k.hira, k)) },
    katakana: { label: '片假名', items: kana.map(k => toItem(k.kata, k)) },
    vocabulary: { label: '單字', items: global.JPQ.VOCAB.slice() }
  };
})(window);