/**
 * 遊戲品牌名稱（固定字串，**不隨介面語言改變**）。
 *
 * 《聞いボード》是遊戲的正式名稱，屬於品牌識別而非介面文字，
 * 因此刻意不放進 i18n 翻譯字典，切換中文／日文／英文時都維持同一個名稱。
 * 詳見 README.md「遊戲標題固定顯示」段落。
 */
export const BRAND_TITLE = "聞いボード";

/** 含書名號的完整呈現形式，結果頁與文件標題使用。 */
export const BRAND_TITLE_DECORATED = `《${BRAND_TITLE}》`;

/** 文件標題用：品牌名稱 + 核心文案（文案本身隨語言切換）。 */
export function brandDocumentTitle(tagline: string): string {
  return `${BRAND_TITLE}｜${tagline}`;
}