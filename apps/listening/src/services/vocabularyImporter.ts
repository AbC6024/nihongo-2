import type { AccentType, Difficulty, ScriptType, WordQuestion } from "../types/question";
import { canonicalCategory } from "../utils/categories";

/**
 * 詞彙匯入器：支援 JSON 與 CSV。
 *
 * 設計原則（見 DATA_SOURCE.md）：
 * - 只匯入使用者自己擁有合法權利的資料，不代為抓取第三方網站內容。
 * - 每筆資料都會做 schema 驗證、重複 ID／重複詞檢查。
 * - 輸出匯入報告（成功筆數、略過筆數、錯誤行與原因）。
 */

export interface ImportIssue {
  line: number;
  reason: string;
  raw?: unknown;
}

export interface ImportReport {
  sourceFormat: "json" | "csv";
  total: number;
  imported: number;
  skipped: number;
  issues: ImportIssue[];
  duplicates: string[];
  result: WordQuestion[];
}

const VALID_DIFFICULTIES: Difficulty[] = ["N5", "N4", "N3", "N2", "N1"];
const VALID_SCRIPTS: ScriptType[] = ["hiragana", "katakana", "mixed"];
const VALID_ACCENTS: AccentType[] = ["atamadaka", "nakadaka", "odaka", "heiban", "unknown"];

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asOptionalString(value: unknown): string | undefined {
  const text = asString(value);
  return text.length > 0 ? text : undefined;
}

function normalizeDifficulty(value: unknown): Difficulty | null {
  const text = asString(value).toUpperCase();
  return (VALID_DIFFICULTIES as string[]).includes(text) ? (text as Difficulty) : null;
}

function normalizeScript(value: unknown, japanese: string): ScriptType {
  const text = asString(value).toLowerCase();
  if ((VALID_SCRIPTS as string[]).includes(text)) return text as ScriptType;
  return /[\u30a0-\u30ff]/.test(japanese) && !/[\u3040-\u309f]/.test(japanese)
    ? "katakana"
    : "hiragana";
}

function normalizeAccent(value: unknown): AccentType {
  const text = asString(value).toLowerCase();
  return (VALID_ACCENTS as string[]).includes(text) ? (text as AccentType) : "unknown";
}

function normalizeBoolean(value: unknown): boolean {
  const text = asString(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

export interface ParseOptions {
  existingIds?: Set<string>;
  existingWords?: Set<string>;
}

/** 驗證並轉換單筆資料。回傳 null 表示此筆無效。 */
export function normalizeWordRecord(
  raw: unknown,
  index: number,
  options: ParseOptions = {},
): { word: WordQuestion | null; issue: ImportIssue | null } {
  if (typeof raw !== "object" || raw === null) {
    return { word: null, issue: { line: index, reason: "資料不是物件", raw } };
  }
  const record = raw as Record<string, unknown>;
  const japanese = asString(record.japanese);
  const romaji = asString(record.romaji);
  const kana = asString(record.kana);

  if (!japanese && !romaji && !kana) {
    return { word: null, issue: { line: index, reason: "缺少 japanese / kana / romaji 至少一項", raw } };
  }
  if (!japanese) {
    return { word: null, issue: { line: index, reason: "缺少 japanese（顯示與朗讀用的日文）", raw } };
  }
  if (!romaji) {
    return { word: null, issue: { line: index, reason: "缺少 romaji（預設輸入方式需要）", raw } };
  }
  if (!kana) {
    return { word: null, issue: { line: index, reason: "缺少 kana（假名讀音）", raw } };
  }

  const difficulty = normalizeDifficulty(record.difficulty);
  if (!difficulty) {
    return {
      word: null,
      issue: { line: index, reason: "difficulty 必須是 N5／N4／N3／N2／N1 之一", raw },
    };
  }

  const id = asOptionalString(record.id) ?? `import-${slug(japanese)}-${index}`;
  if (options.existingIds?.has(id)) {
    return { word: null, issue: { line: index, reason: `ID 重複：${id}`, raw } };
  }
  const wordKey = japanese.toLowerCase();
  if (options.existingWords?.has(wordKey)) {
    return { word: null, issue: { line: index, reason: `詞彙重複：${japanese}`, raw } };
  }

  const accepted = Array.isArray(record.acceptedAnswers)
    ? record.acceptedAnswers.map(asString).filter((item) => item.length > 0)
    : [];

  const accentPatternRaw = record.accentPattern;
  let accentPattern: string | number[] | null = null;
  if (Array.isArray(accentPatternRaw)) {
    accentPattern = accentPatternRaw.map((item) => Number(item)).filter((n) => Number.isFinite(n));
  } else if (typeof accentPatternRaw === "string" && accentPatternRaw.trim().length > 0) {
    accentPattern = accentPatternRaw.trim();
  }

  const word: WordQuestion = {
    id,
    japanese,
    kana,
    romaji,
    meaning: asString(record.meaning),
    difficulty,
    script: normalizeScript(record.script, japanese),
    category: canonicalCategory(asOptionalString(record.category)),
    partOfSpeech: asOptionalString(record.partOfSpeech),
    acceptedAnswers: accepted.length > 0 ? accepted : undefined,
    example: asOptionalString(record.example),
    audio: asOptionalString(record.audio) ?? null,
    image: asOptionalString(record.image) ?? null,
    imageKeyword: asOptionalString(record.imageKeyword),
    imageSource: asOptionalString(record.imageSource),
    imageLicenseNote: asOptionalString(record.imageLicenseNote),
    accentType: normalizeAccent(record.accentType),
    accentPattern,
    accentSource: asOptionalString(record.accentSource),
    // 匯入資料一律視為未驗證，必須人工查核後才能設為 true。
    accentVerified: normalizeBoolean(record.accentVerified),
    audioSource: asOptionalString(record.audioSource),
    audioVerified: normalizeBoolean(record.audioVerified),
    source: asOptionalString(record.source) ?? "imported",
  };

  return { word, issue: null };
}

function slug(value: string): string {
  return value.replace(/\s+/g, "-").slice(0, 24);
}

/** 解析 CSV（支援引號包住含逗號或換行的欄位）。 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    rows.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRecord();
    } else if (char === "\r") {
      /* skip */
    } else {
      field += char;
    }
  }
  if (field.length > 0 || record.length > 0) pushRecord();

  const nonEmpty = rows.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((cell) => cell.trim());
  return nonEmpty.slice(1).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      record[key] = (row[i] ?? "").trim();
    });
    return record;
  });
}

export function parseJson(text: string): unknown[] {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { words?: unknown[] }).words)) {
    return (parsed as { words: unknown[] }).words;
  }
  throw new Error("JSON 必須是陣列，或含有 words 陣列的物件");
}

export function detectFormat(text: string): "json" | "csv" {
  const trimmed = text.trim();
  return trimmed.startsWith("[") || trimmed.startsWith("{") ? "json" : "csv";
}

/**
 * 匯入詞彙。
 * @param text JSON 或 CSV 文字內容
 * @param existing 已經存在的題目（用於重複檢查）
 */
export function importVocabulary(
  text: string,
  existing: WordQuestion[] = [],
): ImportReport {
  const format = detectFormat(text);
  const existingIds = new Set(existing.map((item) => item.id));
  const existingWords = new Set(existing.map((item) => item.japanese.toLowerCase()));
  const result: WordQuestion[] = [];
  const issues: ImportIssue[] = [];
  const duplicates: string[] = [];
  const seenIds = new Set<string>();
  const seenWords = new Set<string>();

  let records: unknown[];
  try {
    records = format === "json" ? parseJson(text) : parseCsv(text);
  } catch (error) {
    return {
      sourceFormat: format,
      total: 0,
      imported: 0,
      skipped: 0,
      issues: [{ line: 0, reason: `解析失敗：${(error as Error).message}` }],
      duplicates,
      result: [],
    };
  }

  records.forEach((raw, i) => {
    const line = i + (format === "csv" ? 2 : 1); // CSV 第 1 行是標題
    const { word, issue } = normalizeWordRecord(raw, line, {
      existingIds,
      existingWords,
    });
    if (!word) {
      issues.push(issue ?? { line, reason: "未知錯誤" });
      return;
    }
    const wordKey = word.japanese.toLowerCase();
    if (seenIds.has(word.id) || seenWords.has(wordKey)) {
      duplicates.push(word.japanese);
      issues.push({ line, reason: `匯入內容內部重複：${word.japanese}` });
      return;
    }
    seenIds.add(word.id);
    seenWords.add(wordKey);
    result.push(word);
  });

  return {
    sourceFormat: format,
    total: records.length,
    imported: result.length,
    skipped: records.length - result.length,
    issues,
    duplicates,
    result,
  };
}