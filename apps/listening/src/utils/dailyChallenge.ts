import type { DailyRecord } from "../types/game";
import { addDays, previousDateKey, type DateKey } from "./date";
import { DAILY_MAX_SCORE } from "./scoring";
import {
  DAILY_FIRST_HALF_COUNT,
  DAILY_TOTAL_QUESTIONS_COUNT,
  composeDailyQuestionIds,
} from "./randomQuestion";

export function createEmptyDailyRecord(): DailyRecord {
  return {
    totalDailyWins: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    completedDates: [],
    dailyBestScoreByDate: {},
    lastDailyQuestionIds: {},
  };
}

export const DAILY_FIRST_HALF = DAILY_FIRST_HALF_COUNT;
export const DAILY_QUESTION_COUNT = DAILY_TOTAL_QUESTIONS_COUNT;

export interface DailyCompositionInput {
  generalIds: string[];
  mistakeIds: string[];
  dateKey?: DateKey;
}

/**
 * 產生今日挑戰的 10 題 ID。
 *
 * 隨機化規則（本次更新）：
 * - 每次開始新局都重新隨機抽取，**不再以日期 seed 鎖定**。
 * - 同一局內盡量不重複。
 * - 前 5 題來自一般題庫，後 5 題優先來自錯題庫。
 */
export function composeDailyQuestionIdsForRound(
  input: DailyCompositionInput,
  random: () => number = Math.random,
): string[] {
  return composeDailyQuestionIds(input, random);
}

/**
 * 取得今日挑戰題目 ID。
 *
 * 行為變更（重要）：
 * - `reuseExisting = false`（預設，符合「每次開始新局都隨機出題」）：
 *   每次呼叫都重新隨機抽取。
 * - `reuseExisting = true`：沿用該局先前抽到的題目，
 *   用於「同一局因重新整理而重新掛載」時保持題目穩定。
 */
export function getDailyQuestionIds(
  record: DailyRecord,
  dateKey: DateKey,
  generalIds: string[],
  mistakeIds: string[],
  reuseExisting = false,
): string[] {
  if (reuseExisting) {
    const saved = record.lastDailyQuestionIds?.[dateKey];
    if (saved && saved.length > 0) return saved;
  }
  return composeDailyQuestionIds({ generalIds, mistakeIds }, Math.random);
}

export function saveDailyQuestionIds(
  record: DailyRecord,
  dateKey: DateKey,
  questionIds: string[],
): DailyRecord {
  return {
    ...record,
    lastDailyQuestionIds: { ...record.lastDailyQuestionIds, [dateKey]: questionIds },
  };
}

export interface DailyCompletionInput {
  dateKey: DateKey;
  score: number;
  record: DailyRecord;
}

export interface DailyCompletionResult {
  record: DailyRecord;
  isNewWin: boolean;
  currentStreak: number;
  bestStreak: number;
}

/**
 * 結算今日挑戰。
 * - 同一天重玩：只更新最佳分數，不增加勝場與連勝
 * - 今天首次完成且昨天也完成：連勝 +1
 * - 今天首次完成但昨天沒完成：連勝 = 1
 * - 最高連勝只增不減
 */
export function completeDailyChallenge(input: DailyCompletionInput): DailyCompletionResult {
  const { dateKey, record } = input;
  const score = Math.max(0, Math.min(DAILY_MAX_SCORE, Math.round(input.score)));
  const completedDates = record.completedDates ?? [];
  const dailyBestScoreByDate = {
    ...(record.dailyBestScoreByDate ?? {}),
    [dateKey]: Math.max(record.dailyBestScoreByDate?.[dateKey] ?? 0, score),
  };

  if (completedDates.includes(dateKey)) {
    return {
      record: {
        ...record,
        dailyBestScoreByDate,
        lastDailyQuestionIds: record.lastDailyQuestionIds ?? {},
      },
      isNewWin: false,
      currentStreak: record.currentStreak,
      bestStreak: record.bestStreak,
    };
  }

  const yesterday = previousDateKey(dateKey);
  const continueStreak = completedDates.includes(yesterday) || record.lastCompletedDate === yesterday;
  const currentStreak = continueStreak ? record.currentStreak + 1 : 1;
  const bestStreak = Math.max(record.bestStreak, currentStreak);

  return {
    record: {
      ...record,
      totalDailyWins: (record.totalDailyWins ?? 0) + 1,
      currentStreak,
      bestStreak,
      lastCompletedDate: dateKey,
      completedDates: [...completedDates, dateKey].sort(),
      dailyBestScoreByDate,
      lastDailyQuestionIds: record.lastDailyQuestionIds ?? {},
    },
    isNewWin: true,
    currentStreak,
    bestStreak,
  };
}

export function isDailyCompleted(record: DailyRecord, dateKey: DateKey): boolean {
  return (record.completedDates ?? []).includes(dateKey);
}

export function getTodayBestScore(record: DailyRecord, dateKey: DateKey): number | null {
  const value = record.dailyBestScoreByDate?.[dateKey];
  return typeof value === "number" ? value : null;
}

/** 供分析頁顯示：目前連勝是否可能延續到今天。 */
export function streakExpectation(record: DailyRecord, dateKey: DateKey): number {
  if (isDailyCompleted(record, dateKey)) return record.currentStreak;
  if (completedRecently(record, dateKey)) return record.currentStreak + 1;
  return 1;
}

function completedRecently(record: DailyRecord, dateKey: DateKey): boolean {
  return (record.completedDates ?? []).includes(previousDateKey(dateKey));
}

export function nextDateKey(dateKey: DateKey): DateKey {
  return addDays(dateKey, 1);
}