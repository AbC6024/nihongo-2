import type { GameRecord, QuestionAttempt } from "../types/game";
import type { DailyRecord } from "../types/game";
import { calculateAccuracy } from "./scoring";
import type { TranslationKey } from "../i18n";

/**
 * 個人檔案的統計資料。
 *
 * 全部由既有的 `GameRecord[]` / `QuestionAttempt[]` / `DailyRecord` 計算，
 * **不另外建立第二套資料系統**，避免與學習分析互相衝突。
 */

export interface ProfileStats {
  totalGames: number;
  totalScore: number;
  bestScore: number;
  lastScore: number | null;
  lastGameAt: string | null;
  totalAnswered: number;
  totalCorrect: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  totalDailyWins: number;
}

export const EMPTY_PROFILE_STATS: ProfileStats = {
  totalGames: 0,
  totalScore: 0,
  bestScore: 0,
  lastScore: null,
  lastGameAt: null,
  totalAnswered: 0,
  totalCorrect: 0,
  accuracy: 0,
  currentStreak: 0,
  bestStreak: 0,
  totalDailyWins: 0,
};

/**
 * 計算個人檔案統計。
 *
 * - 累積獲得分數 = 各局「已記錄的最終分數」加總。
 * - 最高單局分數 = 歷史最高分。
 * - 最近一次分數 = 時間上最新的一局。
 *
 * 分數取自 `GameRecord.score`；該欄位在每局結算時寫入一次，
 * 由 `PlayPage` / `ReviewPage` / `DailyPage` 的 `recordedRef` 或
 * 引擎的 `finishedRef` 保護，**一局只會有一筆紀錄**。
 */
export function computeProfileStats(
  games: GameRecord[],
  attempts: QuestionAttempt[],
  daily: DailyRecord,
): ProfileStats {
  const stats: ProfileStats = { ...EMPTY_PROFILE_STATS };

  if (Array.isArray(games) && games.length > 0) {
    let totalScore = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    let latest: GameRecord | null = null;

    for (const game of games) {
      const score = Number.isFinite(game.score) ? Math.max(0, game.score) : 0;
      totalScore += score;
      if (score > bestScore) bestScore = score;
      if (!latest || game.startedAt > latest.startedAt) latest = game;
    }

    stats.totalGames = games.length;
    stats.totalScore = totalScore;
    stats.bestScore = Number.isFinite(bestScore) ? Math.max(0, bestScore) : 0;
    stats.lastScore = latest ? Math.max(0, latest.score) : null;
    stats.lastGameAt = latest ? latest.endedAt : null;
  }

  if (Array.isArray(attempts) && attempts.length > 0) {
    stats.totalAnswered = attempts.length;
    stats.totalCorrect = attempts.filter((attempt) => attempt.correct).length;
    stats.accuracy = calculateAccuracy({
      correct: stats.totalCorrect,
      answered: stats.totalAnswered,
    });
  }

  stats.currentStreak = daily?.currentStreak ?? 0;
  stats.bestStreak = daily?.bestStreak ?? 0;
  stats.totalDailyWins = daily?.totalDailyWins ?? 0;

  return stats;
}

const MODE_LABELS_FALLBACK: Record<string, TranslationKey> = {
  word: "modeWord",
  sentence: "modeSentence",
  review: "modeReview",
  daily: "modeDaily",
};

/** 千分位格式，讓大數字容易閱讀。 */
export function formatScore(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value)));
}

export function recentGames(games: GameRecord[], limit = 10): GameRecord[] {
  return [...(games ?? [])]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

export function gameModeLabelKey(mode: string): TranslationKey {
  switch (mode) {
    case "word":
      return "modeWord";
    case "sentence":
      return "modeSentence";
    case "review":
      return "modeReview";
    case "daily":
      return "modeDaily";
    default:
      return MODE_LABELS_FALLBACK[mode] ?? "modeWord";
  }
}