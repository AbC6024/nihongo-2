/**
 * 計分規則集中管理。所有模式的計分邏輯都必須呼叫這裡的函式，
 * 不可散落在 UI 元件內。
 */

export const NORMAL_BASE_SCORE = 100;
export const NORMAL_WRONG_PENALTY = 10;
export const SKIP_TOTAL_PENALTY = 50;
export const DAILY_QUESTION_SCORE = 200;
export const DAILY_TOTAL_QUESTIONS = 10;
export const DAILY_MAX_SCORE = DAILY_QUESTION_SCORE * DAILY_TOTAL_QUESTIONS;
export const MAX_WRONG_BEFORE_SKIP_OFFER = 3;

/**
 * 一般／複習模式：答對時本題得分 = max(0, 100 - 答錯次數 * 10)
 * 答錯本身不扣總分，只是降低本題之後能拿到的分數。
 */
export function calculateNormalScore(wrongAttempts: number): number {
  const safe = Number.isFinite(wrongAttempts) && wrongAttempts > 0 ? Math.floor(wrongAttempts) : 0;
  return Math.max(0, NORMAL_BASE_SCORE - safe * NORMAL_WRONG_PENALTY);
}

/**
 * 一般模式跳過：總分扣 50，總分最低 0。
 * 複習模式不使用此函式（複習模式跳過不扣總分）。
 */
export function applySkipPenalty(totalScore: number): number {
  const safe = Number.isFinite(totalScore) ? totalScore : 0;
  return Math.max(0, safe - SKIP_TOTAL_PENALTY);
}

/** 今日挑戰：答對 +200，答錯不扣分，跳過 +0。 */
export function calculateDailyScore(correct: boolean, _skipped = false): number {
  return correct ? DAILY_QUESTION_SCORE : 0;
}

/** 答錯次數達 3 次（含）時提供跳過按鈕。 */
export function canSkip(wrongAttempts: number): boolean {
  return wrongAttempts >= MAX_WRONG_BEFORE_SKIP_OFFER;
}

export interface AccuracyInput {
  correct: number;
  answered: number;
}

export function calculateAccuracy({ correct, answered }: AccuracyInput): number {
  if (!Number.isFinite(answered) || answered <= 0) return 0;
  return Math.round((correct / answered) * 1000) / 10;
}