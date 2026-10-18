import type { ImageMode, WordQuestion, SentenceQuestion } from "../types/question";

type WithImage = WordQuestion | SentenceQuestion;

/**
 * 圖片輔助記憶。
 *
 * 重要限制（見 DATA_SOURCE.md）：
 * - 內建題庫不預設任何圖片，也不批次抓取 いらすとや 等網站的圖片庫。
 * - 圖片必須由人工逐筆確認後，以 `image` / `imageKeyword` / `imageSource` /
 *   `imageLicenseNote` 欄位手動填入題目資料。
 * - `imageMode = "disabled"` 時一律不顯示圖片；`local` 只顯示同源的相對路徑。
 * - 圖片載入失敗時只隱藏圖片區域，不中斷遊戲。
 */
export function resolveImageUrl(
  question: WithImage,
  mode: ImageMode,
): string | null {
  if (mode === "disabled") return null;
  const url = question.image;
  if (!url || typeof url !== "string") return null;
  if (mode === "local" && !/^\.?\/?[a-zA-Z0-9_\-./]/.test(url)) return null;
  return url;
}

export function hasImage(question: WithImage, mode: ImageMode): boolean {
  return resolveImageUrl(question, mode) !== null;
}

export function imageAttribution(question: WithImage): string | null {
  const source = (question as WordQuestion).imageSource;
  const license = (question as WordQuestion).imageLicenseNote;
  if (!source && !license) return null;
  return [source, license].filter(Boolean).join(" / ");
}

export function imageAltText(question: WithImage): string {
  const keyword = (question as WordQuestion).imageKeyword;
  if (keyword) return keyword;
  if ("japanese" in question) return `${question.japanese} 的參考圖片`;
  return "參考圖片";
}