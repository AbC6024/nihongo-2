/* =========================================================
   五十音資料（清音 46 音 + 濁音・半濁音・拗音）
   ========================================================= */
window.JPQ = window.JPQ || {};

/* 清音：以 a 行為開頭，依五十音圖順序 */
JPQ.KANA = [
  { row: 'あ行', css: 'a',    cells: [
    ['あ','a'],['い','i'],['う','u'],['え','e'],['お','o'] ] },
  { row: 'か行', css: 'ka',   cells: [
    ['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko'] ] },
  { row: 'さ行', css: 'sa',   cells: [
    ['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so'] ] },
  { row: 'た行', css: 'ta',   cells: [
    ['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to'] ] },
  { row: 'な行', css: 'na',   cells: [
    ['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no'] ] },
  { row: 'は行', css: 'ha',   cells: [
    ['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho'] ] },
  { row: 'ま行', css: 'ma',   cells: [
    ['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo'] ] },
  { row: 'や行', css: 'ya',   cells: [
    ['や','ya'],null,['ゆ','yu'],null,['よ','yo'] ] },
  { row: 'ら行', css: 'ra',   cells: [
    ['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro'] ] },
  { row: 'わ行', css: 'wa',   cells: [
    ['わ','wa'],null,null,null,['を','wo'] ] },
  { row: 'ん', css: 'n', cells: [
    ['ん','n'],null,null,null,null ] }
];

/* 濁音・半濁音 */
JPQ.DAKU = [
  { row: 'が行', css: 'g',  cells: [['が','ga'],['ぎ','gi'],['ぐ','gu'],['げ','ge'],['ご','go']] },
  { row: 'ざ行', css: 'z',  cells: [['ざ','za'],['じ','ji'],['ず','zu'],['ぜ','ze'],['ぞ','zo']] },
  { row: 'だ行', css: 'd',  cells: [['だ','da'],['ぢ','ji'],['づ','zu'],['で','de'],['ど','do']] },
  { row: 'ば行', css: 'b',  cells: [['ば','ba'],['び','bi'],['ぶ','bu'],['べ','be'],['ぼ','bo']] },
  { row: 'ぱ行', css: 'p',  cells: [['ぱ','pa'],['ぴ','pi'],['ぷ','pu'],['ぺ','pe'],['ぽ','po']] }
];

/* 拗音（只列平假名＋片假名對照，順序題不收） */
JPQ.YOON = [
  ['きゃ','kya'], ['しゅ','shu'], ['ちょ','cho'],
  ['にゃ','nya'], ['ひょ','hyo'], ['みょ','myo'],
  ['りゃ','rya'], ['ぎゃ','gya'], ['じょ','jo'],
  ['びょ','byo'], ['ぴょ','pyo']
];

/* 工具函式 */
JPQ.kana = {
  /* 清音攤平成 [{hira, kata, romaji, row, i}] */
  list: function () {
    const out = [];
    JPQ.KANA.forEach(r => r.cells.forEach((c, i) => {
      if (!c) return;
      out.push({
        hira: c[0], romaji: c[1], row: r.row, col: i,
        kata: toKata(c[0])
      });
    }));
    return out;
  },
  dakuList: function () {
    const out = [];
    JPQ.DAKU.forEach(r => r.cells.forEach(c => {
      out.push({ hira: c[0], romaji: c[1], row: r.row, kata: toKata(c[0]) });
    }));
    return out;
  },
  byRomaji: function (romaji) {
    return JPQ.kana.list().find(k => k.romaji === romaji) || null;
  },
  toKatakana: toKata
};

/* 平假名 → 片假名（包含拗音中的小寫 ゃ／ゅ／ょ） */
function toKata(h) {
  return Array.from(String(h)).map(ch => {
    const code = ch.charCodeAt(0);
    return code >= 0x3041 && code <= 0x3096
      ? String.fromCharCode(code + 0x60)
      : ch;
  }).join('');
}
