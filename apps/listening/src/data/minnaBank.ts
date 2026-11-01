/**
 * 《みんなの日本語》題庫載入器。
 *
 * 將 `src/data/minnaNoNihongo.json`（594 筆，來自教材照片整理）轉換為
 * 專案既有的 `WordQuestion` 型別，並整合進遊戲。
 *
 * 設計原則：
 * 1. **不修改題庫內容**：JSON 中的 japanese / reading / chinese 等欄位原樣保留，
 *    不自行刪除、修改或替換單字。
 * 2. **重複單字保留課次資訊**：若同一個日文單字出現在多個課次，會建立
 *    多筆記錄（不同 id），每筆保留所屬課次，避免單字重複影響遊戲體驗。
 * 3. **重音資料不作為答案**：`accent_verified` 一律為 false，重音數字不納入
 *    答案判定，也不自行猜測。
 * 4. **自動產生 romaji**：JSON 無 romaji 欄位，從 `reading`（假名）自動轉換，
 *    供羅馬字輸入模式使用。
 * 5. **沒有音檔與圖片**：`audio` / `image` 一律 null，播放時使用瀏覽器
 *    Web Speech API（ja-JP）機器語音。
 */

import type { ScriptType, WordQuestion } from "../types/question";
import { kanaToRomaji } from "../utils/kanaToRomaji";
import { parseLessonNumber } from "../utils/lessons";

const JSON_IMPORT_SOURCE = "みんなの日本語（教材照片整理）";

/** JSON 原始資料的型別。 */
export interface MinnaNoNihongoEntry {
  section: string;
  japanese: string;
  reading: string;
  chinese: string;
  accent_number: number | null;
  accent_type: string;
  accent_status: string;
  source: string;
  original_accent_number: number | null;
  original_accent_status: string;
  accent_verified: boolean;
  accent_verification_source: string;
  game_accent_number: number | null;
  game_accent_enabled: boolean;
}

/** 由日文文字推導 script。 */
function detectScript(japanese: string): ScriptType {
  if (/^[\u30a1-\u30f6\u30fc\u30fb]+$/.test(japanese)) return "katakana";
  if (/^[\u3041-\u3096\u30fc\u30fb]+$/.test(japanese)) return "hiragana";
  return "mixed";
}

/** 建立唯一識別碼：以 japanese + 課次編號為鍵，同一單字在不同課次會得到不同 id。 */
function buildId(japanese: string, lessonNumber: number | null, index: number): string {
  const lessonPart = lessonNumber !== null ? `L${lessonNumber}` : "L0";
  const hashPart = japanese
    .split("")
    .reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);
  return `m-${lessonPart}-${hashPart.toString(36)}-${index}`;
}

/** 被移除的題目紀錄（供文件與測試使用）。 */
export const REMOVED_ENTRIES: { japanese: string; section: string; reason: string }[] = [];

/** 將 JSON 陣列轉為 WordQuestion[]，同時過濾不完整/無法作答的題目。 */
export function loadMinnaNoNihongoBank(entries: MinnaNoNihongoEntry[]): WordQuestion[] {
  const words: WordQuestion[] = [];
  const removedLog: { japanese: string; section: string; reason: string }[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const japanese = entry.japanese.trim();
    const reading = entry.reading.trim();
    const meaning = entry.chinese.trim();
    const lessonNumber = parseLessonNumber(entry.section);

    // ── 題庫清理：移除不完整、無法正常作答的題目 ──
    // 1. 讀音包含 ～/~ /〜（模板詞，無法作為完整答案）
    if (reading.includes("～") || reading.includes("~") || reading.includes("〜")) {
      removedLog.push({ japanese, section: entry.section, reason: "讀音包含 ～，為模板詞，無法直接作答" });
      continue;
    }
    // 2. 日文以 ～ 開頭或結尾（模板前綴/後綴）
    if (japanese.startsWith("～") || japanese.startsWith("~") || japanese.startsWith("〜") ||
        japanese.endsWith("～") || japanese.endsWith("~") || japanese.endsWith("〜")) {
      removedLog.push({ japanese, section: entry.section, reason: "日文為模板詞（以 ～ 開頭或結尾），無法直接作答" });
      continue;
    }
    // 3. 缺少必要資料
    if (!japanese || !reading || !meaning || lessonNumber === null) {
      removedLog.push({ japanese, section: entry.section, reason: "缺少必要資料（日文/讀音/中文/課次）" });
      continue;
    }

    // romaji 從假名自動產生
    const romaji = kanaToRomaji(reading);

    // 課次作為 category（例如 "第1課"）
    const category = lessonNumber !== null ? `第${lessonNumber}課` : "未分類";

    const word: WordQuestion = {
      id: buildId(japanese, lessonNumber, i),
      japanese,
      kana: reading,
      romaji,
      meaning,
      difficulty: undefined, // JSON 無難度欄位，不自行填入
      script: detectScript(japanese),
      category,
      partOfSpeech: undefined,
      acceptedAnswers: undefined,
      accentType: "unknown",
      accentPattern: null,
      accentSource: entry.source,
      accentVerified: false, // 一律未驗證，不宣稱符合 OJAD
      audio: null,
      image: null,
      source: JSON_IMPORT_SOURCE,
    };

    words.push(word);
  }

  // 將移除紀錄寫入全域陣列
  REMOVED_ENTRIES.length = 0;
  REMOVED_ENTRIES.push(...removedLog);

  return words;
}

/** 從 JSON 檔案路徑載入（由匯入頁面或測試呼叫）。 */
export async function loadMinnaNoNihongoBankFromJson(
  jsonText: string,
): Promise<{ words: WordQuestion[]; total: number; skipped: number; issues: string[] }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    return {
      words: [],
      total: 0,
      skipped: 0,
      issues: [`JSON 解析失敗：${(error as Error).message}`],
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      words: [],
      total: 0,
      skipped: 0,
      issues: ["JSON 根級別必須是陣列"],
    };
  }

  const entries = parsed as MinnaNoNihongoEntry[];
  const issues: string[] = [];
  let skipped = 0;

  const validEntries = entries.filter((entry, index) => {
    if (!entry || typeof entry !== "object") {
      issues.push(`第 ${index + 1} 筆：資料不是物件`);
      skipped += 1;
      return false;
    }
    if (!entry.japanese || typeof entry.japanese !== "string") {
      issues.push(`第 ${index + 1} 筆：缺少 japanese`);
      skipped += 1;
      return false;
    }
    if (!entry.reading || typeof entry.reading !== "string") {
      issues.push(`第 ${index + 1} 筆（${entry.japanese}）：缺少 reading`);
      skipped += 1;
      return false;
    }
    if (!entry.chinese || typeof entry.chinese !== "string") {
      issues.push(`第 ${index + 1} 筆（${entry.japanese}）：缺少 chinese`);
      skipped += 1;
      return false;
    }
    return true;
  });

  const words = loadMinnaNoNihongoBank(validEntries);

  return {
    words,
    total: entries.length,
    skipped,
    issues,
  };
}

/** 匯出的題庫陣列（在模組載入時解析 JSON 檔案）。 */
let _cachedWords: WordQuestion[] | null = null;

export function getMinnaNoNihongoWords(): WordQuestion[] {
  if (_cachedWords) return _cachedWords;
  // 注意：此函式在 Node/ Vitest 環境下可直接 import JSON；
  // 在 Vite 建置時，會透過 import 語句載入 JSON。
  // 這裡提供一個延遲載入的入口，實際內容由 minnaBankLoaded.ts 填入。
  return [];
}

/** 載入的題庫總數（供 UI 顯示）。 */
export let MINNA_NO_NIHONGO_COUNT = 0;

/** 所有課次清單（自動從 JSON 建立）。 */
export let MINNA_LESSONS: { number: number; name: string }[] = [];

/** 每課的題目數量。 */
export let LESSON_COUNTS: Record<number, number> = {};

/** 以課次編號為 key 的題目 Map（供篩選使用）。 */
export let WORDS_BY_LESSON: Map<number, WordQuestion[]> = new Map();

/** 以 id 為 key 的題目 Map。 */
export let WORD_MAP: Map<string, WordQuestion> = new Map();

export function initializeMinnaBank(words: WordQuestion[]): void {
  _cachedWords = words;
  MINNA_NO_NIHONGO_COUNT = words.length;

  const lessons = new Set<number>();
  const byLesson = new Map<number, WordQuestion[]>();
  const wordMap = new Map<string, WordQuestion>();

  for (const word of words) {
    const match = word.category.match(/^第(\d+)課$/);
    if (match) {
      const lessonNumber = Number(match[1]);
      lessons.add(lessonNumber);
      if (!byLesson.has(lessonNumber)) byLesson.set(lessonNumber, []);
      byLesson.get(lessonNumber)!.push(word);
    }
    wordMap.set(word.id, word);
  }

  MINNA_LESSONS = Array.from(lessons)
    .sort((a, b) => a - b)
    .map((n) => ({ number: n, name: `第${n}課` }));

  LESSON_COUNTS = {};
  for (const [n, ws] of byLesson) {
    LESSON_COUNTS[n] = ws.length;
  }

  WORDS_BY_LESSON = byLesson;
  WORD_MAP = wordMap;
}