/**
 * 日文音拍（モーラ）計算。
 *
 * 規則：
 * - 一般假名（平假名、片假名、半形片假名）各算 1 拍。
 * - 拗音的後半小書き（ゃゅょ ャュョ，以及 ぁぃぅぇぉ ァィゥェォ）不獨立成拍，
 *   例如「きょう」= き + ょ（不計）+ う = 2 拍。
 * - 小促音「っ／ッ」算 1 拍。
 * - 撥音「ん／ン」算 1 拍。
 * - 長音符「ー」（以及長音符變體）算 1 拍。
 * - 濁音・半濁音（がぱ等）本身各算 1 拍（由一般假名規則自然涵蓋）。
 * - 反覆記號「ゝゞ」算 1 拍。
 * - 漢字、標點、拉丁字母等非假名字元不計入音拍。
 */

/** 拗音後半的小書き假名，不獨立成拍。 */
const SMALL_YON = new Set(["ゃ", "ゅ", "ょ", "ャ", "ュ", "ョ", "ゎ", "ヮ"]);

/** 其他小書き假名（例如 ふぁ、ウィ），同樣不獨立成拍。 */
const SMALL_OTHER = new Set([
  "ぁ",
  "ぃ",
  "ぅ",
  "ぇ",
  "ぉ",
  "ゕ",
  "ゖ",
  "ァ",
  "ィ",
  "ゥ",
  "ェ",
  "ォ",
  "ヵ",
  "ヶ",
  "ゕ",
  "ゖ",
]);

/** 長音符與其常見變體，各算 1 拍。 */
const LONG_MARK = new Set(["ー", "―", "〜", "～", "ｰ", "─", "—"]);

/** 反覆記號，各算 1 拍。 */
const ITERATION_MARK = new Set(["ゝ", "ゞ", "ヽ", "ヾ", "〱", "〲"]);

function code(ch: string): number {
  return ch.charCodeAt(0);
}

/** 是否為一般假名（平假名、片假名、半形片假名）。 */
export function isKana(ch: string): boolean {
  const c = code(ch);
  // 平假名
  if (c >= 0x3041 && c <= 0x3096) return true;
  // 片假名
  if (c >= 0x30a1 && c <= 0x30fa) return true;
  // 半形片假名
  if (c >= 0xff66 && c <= 0xff9d) return true;
  return false;
}

/** 是否為濁點・半濁點（單獨出現時不計音拍）。 */
function isVoicingMark(ch: string): boolean {
  const c = code(ch);
  return c === 0x309b || c === 0x309c || c === 0xff9e || c === 0xff9f;
}

/** 文字是否含有假名；不含時音拍為 0（例如純漢字詞彙）。 */
export function containsKana(text: string): boolean {
  for (const ch of text) {
    if (isKana(ch)) return true;
  }
  return false;
}

/**
 * 計算音拍數。回傳 0 代表無法判斷（例如只有漢字或非日文文字）。
 */
export function countMora(text: string): number {
  if (!text) return 0;
  let mora = 0;
  for (const ch of text) {
    if (SMALL_YON.has(ch) || SMALL_OTHER.has(ch)) continue;
    if (isVoicingMark(ch)) continue;
    if (LONG_MARK.has(ch) || ITERATION_MARK.has(ch)) {
      mora += 1;
      continue;
    }
    if (isKana(ch)) {
      // 小促音「っ／ッ」與撥音「ん／ン」在這個分支自然各算 1 拍。
      mora += 1;
    }
  }
  return mora;
}

/**
 * 取題目的音拍依據文字。
 * 優先使用假名讀音；沒有假名時退回日文詞彙（若為漢字則得 0）。
 */
export function moraSourceText(candidate: { kana?: string; japanese?: string }): string {
  if (candidate.kana && containsKana(candidate.kana)) return candidate.kana;
  if (candidate.japanese && containsKana(candidate.japanese)) return candidate.japanese;
  return candidate.kana ?? candidate.japanese ?? "";
}

/** 題目的音拍數；無法判斷時為 0。 */
export function countQuestionMora(candidate: { kana?: string; japanese?: string }): number {
  return countMora(moraSourceText(candidate));
}