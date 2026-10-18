/**
 * 答案正規化與比對。
 * 規則：只接受題目明確設定的答案（romaji / 日文 / acceptedAnswers），
 * 僅做大小寫、空白、Unicode 表示差異的正規化，不做模糊比對。
 */

const KANA_OFFSET = 0x60;

function isKatakanaChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x30a1 && code <= 0x30f6;
}

/** 片假名轉平假名（保留長音符「ー」）。 */
export function katakanaToHiragana(input: string): string {
  let out = "";
  for (const ch of input) {
    if (ch === "ー") {
      out += ch;
      continue;
    }
    if (isKatakanaChar(ch)) {
      out += String.fromCharCode(ch.charCodeAt(0) - KANA_OFFSET);
    } else {
      out += ch;
    }
  }
  return out;
}

/** 全形英數 → 半形、合成分解 → 合成等 Unicode 正規化。 */
export function normalizeUnicode(input: string): string {
  return input.normalize("NFKC");
}

/** 去掉前後空白、合併連續空白、統一長音符「ー」與長音符的表現差異。 */
export function normalizeBase(input: string): string {
  return normalizeUnicode(input)
    .trim()
    .replace(/[\s\u3000]+/g, " ");
}

/** 正規化後再轉小寫（拉丁字母比對用）。 */
export function normalizeLatin(input: string): string {
  return normalizeBase(input).toLowerCase();
}

function hasJapanese(input: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u.test(input);
}

/**
 * 產生比對用的 canonical key。
 * - 拉丁文（romaji）：小寫、去掉所有空白，容忍 "ne ko" / "Neko " 等輸入差異
 * - 含有日文字：去空白、片假名轉平假名、統一「ー」
 */
export function canonicalKey(input: string): string {
  const base = normalizeBase(input);
  if (!base) return "";
  if (hasJapanese(base)) {
    return katakanaToHiragana(base).replace(/[\s\u3000]/g, "").replace(/・/g, "");
  }
  return base.toLowerCase().replace(/[\s\u3000.'-]/g, "");
}

export function isRomajiLike(input: string): boolean {
  const base = normalizeBase(input);
  return base.length > 0 && /^[\x20-\x7e]+$/.test(base);
}

export interface MatchableAnswer {
  romaji?: string | null;
  kana?: string | null;
  japanese?: string | null;
  acceptedAnswers?: string[];
}

/**
 * 取得某題目可接受的答案字串集合。
 * 只包含題目資料明確提供的值。
 */
export function buildAcceptedSet(answer: MatchableAnswer): string[] {
  const raw: string[] = [];
  if (answer.japanese) raw.push(answer.japanese);
  if (answer.kana) raw.push(answer.kana);
  if (answer.romaji) raw.push(answer.romaji);
  if (Array.isArray(answer.acceptedAnswers)) raw.push(...answer.acceptedAnswers);
  return raw.map((value) => value.trim()).filter((value) => value.length > 0);
}

/**
 * 判斷輸入是否正確。
 * 比對範圍限定於 buildAcceptedSet 回傳的答案，採用 canonicalKey 比對。
 */
export function isAnswerCorrect(userInput: string, answer: MatchableAnswer): boolean {
  const key = canonicalKey(userInput);
  if (!key) return false;
  return buildAcceptedSet(answer).some((candidate) => canonicalKey(candidate) === key);
}

/** 對外顯示用的正規化答案（給玩家看的「你輸入的內容」）。 */
export function displayNormalizedInput(userInput: string): string {
  return normalizeBase(userInput);
}