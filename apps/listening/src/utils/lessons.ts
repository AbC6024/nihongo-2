/**
 * 《みんなの日本語》課次輔助工具。
 *
 * 從 JSON 資料的 `section` 欄位中解析課次編號，並建立課次分類清單。
 *
 * section 格式範例：
 *   "1-單語" → 第1課
 *   "2-單語前半" → 第2課
 *   "4-單語(60頁)" → 第4課
 *   "8-單語(形容詞)" → 第8課
 *   "12-單語" → 第12課
 */

/** 解析 section 字串中的課次數字。回傳 null 表示無法解析。 */
export function parseLessonNumber(section: string | null | undefined): number | null {
  if (typeof section !== "string") return null;
  const match = section.match(/^(\d+)-/);
  if (!match) return null;
  return Number(match[1]);
}

/** 將課次數字格式化為顯示名稱（例如 1 → "第1課"）。 */
export function formatLessonName(lessonNumber: number): string {
  return `第${lessonNumber}課`;
}

/** 從 section 陣列中自動建立課次清單，依數字由小到大排序。 */
export function buildLessons(sections: readonly string[]): { number: number; name: string }[] {
  const seen = new Set<number>();
  for (const section of sections) {
    const n = parseLessonNumber(section);
    if (n !== null) seen.add(n);
  }
  return Array.from(seen)
    .sort((a, b) => a - b)
    .map((n) => ({ number: n, name: formatLessonName(n) }));
}

/** 判斷單字是否屬於指定課次。 */
export function belongsToLesson(section: string | null | undefined, lessonNumber: number): boolean {
  return parseLessonNumber(section) === lessonNumber;
}

/** 全部課次的特殊標記。 */
export const ALL_LESSONS = "全部課次";

export type LessonFilter = number | typeof ALL_LESSONS;