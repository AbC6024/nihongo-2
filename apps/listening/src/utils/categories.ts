/**
 * 題目分類（category）的單一來源。
 *
 * 本次更新後，分類改為《みんなの日本語》的課次（例如 "第1課"、「第2課"）。
 * 分類清單從題庫資料中自動建立，不再硬編碼。
 *
 * 舊版本的分類名（例如 "交通"、"食物"）會透過別名對照轉成課次，
 * 但本次題庫已全面替換，舊分類主要為相容性保留。
 */

/** 從分類名稱中提取課次數字（例如 "第1課" → 1）。無法解析時回傳 -1。 */
export function lessonNumberFromCategory(category: string): number {
  const match = category.match(/^第(\d+)課$/);
  return match ? Number(match[1]) : -1;
}

/** 依課次數字由小到大排序；非課次分類排在最後並依名稱排序。 */
export function sortCategories(categories: readonly string[]): string[] {
  const lessons = Array.from(categories)
    .filter((c) => /^第\d+課$/.test(c))
    .sort((a, b) => lessonNumberFromCategory(a) - lessonNumberFromCategory(b));
  const custom = Array.from(categories)
    .filter((c) => !/^第\d+課$/.test(c))
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));
  return [...lessons, ...custom];
}

/** 所有課次的特殊標記。 */
export const ALL_LESSONS = "全部課次";

/** 判斷分類是否為課次格式。 */
export function isLessonCategory(category: string): boolean {
  return /^第\d+課$/.test(category);
}

/** 未登錄的自訂詞彙沿用既有預設分類。 */
export const FALLBACK_CATEGORY = "第1課";

const CATEGORY_SET: ReadonlySet<string> = new Set<string>();

/** 舊分類名 → 新分類名（相容性用）。 */
export const CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  交通: "第2課",
  食物: "第3課",
  動物: "第2課",
  校園: "第1課",
  工作: "第1課",
  慣用語: "第8課",
  學校: "第1課",
  健康: "第4課",
  情緒: "第9課",
  溝通: "第9課",
  科技: "第5課",
  天氣: "第6課",
  天災: "第6課",
  環境: "第6課",
  進階詞彙: "第8課",
  抽象詞彙: "第8課",
  口語: "第9課",
  四字熟語: "第8課",
  "口語／俚語": "第9課",
  未分類: FALLBACK_CATEGORY,
};

/** 轉成正式分類；無法對應時視為預設分類。 */
export function canonicalCategory(raw: string | null | undefined): string {
  if (typeof raw !== "string") return FALLBACK_CATEGORY;
  const trimmed = raw.trim();
  if (!trimmed) return FALLBACK_CATEGORY;
  if (CATEGORY_SET.has(trimmed)) return trimmed;
  const alias = CATEGORY_ALIASES[trimmed];
  if (alias) return alias;
  return trimmed;
}

/** 批次轉換設定裡的分類陣列，並去重。 */
export function canonicalCategories(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const item of raw) seen.add(canonicalCategory(item));
  return Array.from(seen);
}