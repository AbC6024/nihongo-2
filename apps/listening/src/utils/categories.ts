/**
 * 題目分類（category）的單一來源。
 *
 * 設計重點：
 * 1. 全專案只維護一份分類清單，避免出現「交通」與「交通與旅行」這種
 *    語意重疊卻無法合併的篩選鈕。
 * 2. 舊題庫、玩家匯入的自訂詞彙，以及舊版本存進 localStorage 的
 *    `settings.categories`，都會透過 `canonicalCategory()` 轉成新分類，
 *    因此升級後舊資料不會突然篩不到題目。
 */

/** 正式分類（顯示順序即玩家看到的順序）。 */
export const CATEGORY_ORDER = [
  "日常生活",
  "交通與旅行",
  "食物與飲食",
  "動物與自然生態",
  "學校與工作",
  "居家與健康",
  "情緒與溝通",
  "科技與數位生活",
  "天氣與環境",
  "抽象詞彙與進階表現",
  "慣用表現",
  "口語與俚語",
  "新聞・書面語",
] as const;

export type Category = (typeof CATEGORY_ORDER)[number];

/** 未登錄的自訂詞彙沿用既有預設分類。 */
export const FALLBACK_CATEGORY = "抽象詞彙與進階表現";

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORY_ORDER);

/**
 * 舊分類名 → 正式分類名。
 *
 * 涵蓋三種來源：
 * - v1 題庫用的簡稱（交通／食物／動物／校園／工作／慣用語）
 * - 本次題庫沿用規格書的簡稱（學校／健康／情緒／溝通／科技／天氣／
 *   天災／環境／進階詞彙／口語）
 * - 慣用表現題庫的原始分類（四字熟語、口語／俚語）
 */
export const CATEGORY_ALIASES: Readonly<Record<string, Category>> = {
  // v1 題庫簡稱
  交通: "交通與旅行",
  食物: "食物與飲食",
  動物: "動物與自然生態",
  校園: "學校與工作",
  工作: "學校與工作",
  慣用語: "慣用表現",
  // 本次題庫簡稱
  學校: "學校與工作",
  健康: "居家與健康",
  情緒: "情緒與溝通",
  溝通: "情緒與溝通",
  科技: "科技與數位生活",
  天氣: "天氣與環境",
  天災: "天氣與環境",
  環境: "天氣與環境",
  進階詞彙: "抽象詞彙與進階表現",
  抽象詞彙: "抽象詞彙與進階表現",
  口語: "口語與俚語",
  // 慣用表現題庫原始分類
  四字熟語: "慣用表現",
  "口語／俚語": "口語與俚語",
  // 匯入器的預設分類
  未分類: FALLBACK_CATEGORY,
};

/** 轉成正式分類；無法對應時視為未登錄分類。 */
export function canonicalCategory(raw: string | null | undefined): Category {
  if (typeof raw !== "string") return FALLBACK_CATEGORY;
  const trimmed = raw.trim();
  if (!trimmed) return FALLBACK_CATEGORY;
  if (CATEGORY_SET.has(trimmed)) return trimmed as Category;
  const alias = CATEGORY_ALIASES[trimmed];
  if (alias) return alias;
  // 未登錄的自訂分類原樣保留，不要默默改掉玩家自己的分類名稱。
  return trimmed as Category;
}

/** 批次轉換設定裡的分類陣列，並去重。 */
export function canonicalCategories(raw: readonly string[]): Category[] {
  const seen = new Set<Category>();
  for (const item of raw) seen.add(canonicalCategory(item));
  return Array.from(seen);
}

/** 依正式分類排序；未登錄的自訂分類排在最後並依名稱排序。 */
export function sortCategories(categories: readonly string[]): string[] {
  const seen = new Set(categories.map((category) => canonicalCategory(category)));
  const known = CATEGORY_ORDER.filter((category) => seen.has(category));
  const custom = Array.from(seen)
    .filter((category) => !CATEGORY_SET.has(category))
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));
  return [...known, ...custom];
}