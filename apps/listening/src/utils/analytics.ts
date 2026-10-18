import type { GameRecord, MistakeEntry, QuestionAttempt } from "../types/game";
import type {
  AnalyticsSummary,
  CategoryStat,
  LevelStat,
  ModeStat,
} from "../types/analytics";
import {
  classifyStat,
  MIN_ATTEMPTS_FOR_VERDICT,
  STRONG_ACCURACY,
  STRONG_AVG_WRONG,
  WEAK_ACCURACY,
  WEAK_AVG_WRONG,
} from "../types/analytics";
import { toLocalDateKey } from "./date";
import { isDailyCompleted } from "./dailyChallenge";
import type { TranslationKey } from "../i18n";

export const MODE_LABELS: Record<string, string> = {
  word: "快速單字",
  sentence: "句子填空",
  review: "複習模式",
  daily: "今日挑戰",
};

/**
 * 模式與評判定對應的翻譯鍵值。
 * 介面文字交由 i18n 翻譯，這裡只維護對應關係。
 */
export const MODE_LABEL_KEYS: Record<string, TranslationKey> = {
  word: "modeWord",
  sentence: "modeSentence",
  review: "modeReview",
  daily: "modeDaily",
};

export const VERDICT_LABEL_KEYS: Record<CategoryStat["verdict"], TranslationKey> = {
  strong: "strongLabel",
  practice: "practiceLabel",
  weak: "weakLabel",
  insufficient: "insufficientLabel",
};

/** 僅供非 React 環境（例如測試或報告輸出）使用的繁中標籤。 */
export const VERDICT_LABELS: Record<CategoryStat["verdict"], string> = {
  strong: "強項",
  practice: "持續練習",
  weak: "待加強",
  insufficient: "資料不足",
};

interface Aggregate {
  attempts: number;
  correct: number;
  wrongSum: number;
  skipped: number;
  responseSum: number;
}

function emptyAggregate(): Aggregate {
  return { attempts: 0, correct: 0, wrongSum: 0, skipped: 0, responseSum: 0 };
}

function pushAggregate(map: Map<string, Aggregate>, key: string, attempt: QuestionAttempt) {
  const bucket = map.get(key) ?? emptyAggregate();
  bucket.attempts += 1;
  if (attempt.correct) bucket.correct += 1;
  bucket.wrongSum += attempt.wrongAttempts;
  if (attempt.skipped) bucket.skipped += 1;
  bucket.responseSum += Math.max(0, attempt.responseTimeMs);
  map.set(key, bucket);
}

function accuracyOf(bucket: { attempts: number; correct: number }): number {
  if (bucket.attempts === 0) return 0;
  return bucket.correct / bucket.attempts;
}

function avgWrongOf(bucket: Aggregate): number {
  if (bucket.attempts === 0) return 0;
  return bucket.wrongSum / bucket.attempts;
}

function avgResponseOf(bucket: Aggregate): number {
  if (bucket.attempts === 0) return 0;
  return bucket.responseSum / bucket.attempts;
}

/** 平均作答時間（毫秒），供測試與日後擴充使用。 */
export function averageResponseTime(bucket: {
  attempts: number;
  responseSum: number;
}): number {
  return avgResponseOf(bucket as Aggregate);
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export interface AnalyticsInput {
  attempts: QuestionAttempt[];
  games: GameRecord[];
  mistakes: Record<string, MistakeEntry>;
  daily: {
    totalDailyWins: number;
    currentStreak: number;
    bestStreak: number;
    lastCompletedDate: string | null;
    completedDates: string[];
    dailyBestScoreByDate: Record<string, number>;
    lastDailyQuestionIds: Record<string, string[]>;
  };
  todayKey?: string;
}

export function buildAnalytics(input: AnalyticsInput): AnalyticsSummary {
  const todayKey = input.todayKey ?? toLocalDateKey();
  const attempts = input.attempts ?? [];
  const totalAttempts = attempts.length;
  const totalCorrect = attempts.filter((attempt) => attempt.correct).length;
  const totalSkipped = attempts.filter((attempt) => attempt.skipped).length;
  const wrongSum = attempts.reduce((sum, attempt) => sum + attempt.wrongAttempts, 0);
  const responseSum = attempts.reduce((sum, attempt) => sum + Math.max(0, attempt.responseTimeMs), 0);

  const levelMap = new Map<string, Aggregate>();
  const categoryMap = new Map<string, Aggregate>();
  const modeMap = new Map<string, Aggregate>();
  const wrongByQuestion = new Map<string, { wrongCount: number; skipCount: number }>();

  for (const attempt of attempts) {
    pushAggregate(levelMap, attempt.difficulty, attempt);
    pushAggregate(categoryMap, attempt.category, attempt);
    pushAggregate(modeMap, attempt.gameMode, attempt);
    const entry = wrongByQuestion.get(attempt.questionId) ?? { wrongCount: 0, skipCount: 0 };
    entry.wrongCount += attempt.wrongAttempts;
    if (attempt.skipped) entry.skipCount += 1;
    wrongByQuestion.set(attempt.questionId, entry);
  }

  const levelStats: LevelStat[] = ["N5", "N4", "N3", "N2", "N1"].map((difficulty) => {
    const bucket = levelMap.get(difficulty) ?? emptyAggregate();
    return {
      difficulty,
      attempts: bucket.attempts,
      accuracy: round(accuracyOf(bucket)),
      avgWrong: round(avgWrongOf(bucket), 2),
      verdict: classifyStat(bucket.attempts, accuracyOf(bucket), avgWrongOf(bucket)),
    };
  });

  const categoryStats: CategoryStat[] = Array.from(categoryMap.entries())
    .map(([key, bucket]) => ({
      key,
      label: key,
      attempts: bucket.attempts,
      correct: bucket.correct,
      accuracy: round(accuracyOf(bucket)),
      avgWrong: round(avgWrongOf(bucket), 2),
      skipped: bucket.skipped,
      verdict: classifyStat(bucket.attempts, accuracyOf(bucket), avgWrongOf(bucket)),
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const modeStats: ModeStat[] = Array.from(modeMap.entries())
    .map(([mode, bucket]) => ({
      mode,
      attempts: bucket.attempts,
      accuracy: round(accuracyOf(bucket)),
      avgWrong: round(avgWrongOf(bucket), 2),
      skipped: bucket.skipped,
      verdict: classifyStat(bucket.attempts, accuracyOf(bucket), avgWrongOf(bucket)),
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const frequentWrong = Array.from(wrongByQuestion.entries())
    .map(([questionId, value]) => ({ questionId, ...value }))
    .filter((item) => item.wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount || a.questionId.localeCompare(b.questionId))
    .slice(0, 10);

  const frequentSkipped = Array.from(wrongByQuestion.entries())
    .map(([questionId, value]) => ({ questionId, ...value }))
    .filter((item) => item.skipCount > 0)
    .sort((a, b) => b.skipCount - a.skipCount || a.questionId.localeCompare(b.questionId))
    .slice(0, 10);

  const todayAttempts = attempts.filter((attempt) => attempt.localDate === todayKey);
  const todayCorrect = todayAttempts.filter((attempt) => attempt.correct).length;

  const mistakes = input.mistakes ?? {};
  const starredCount = Object.values(mistakes).filter((entry) => entry.starred).length;

  return {
    totalGames: (input.games ?? []).length,
    totalAttempts,
    totalCorrect,
    overallAccuracy: round(accuracyOf({ attempts: totalAttempts, correct: totalCorrect })),
    avgResponseTimeMs: totalAttempts === 0 ? 0 : Math.round(responseSum / totalAttempts),
    avgWrongAttempts: totalAttempts === 0 ? 0 : round(wrongSum / totalAttempts, 2),
    totalSkipped,
    levelStats,
    categoryStats,
    modeStats,
    frequentWrong,
    frequentSkipped,
    starredCount,
    mistakeCount: Object.keys(mistakes).length,
    today: {
      dateKey: todayKey,
      attempts: todayAttempts.length,
      correct: todayCorrect,
      accuracy: round(
        accuracyOf({ attempts: todayAttempts.length, correct: todayCorrect }),
      ),
    },
    dailyStreak: {
      totalDailyWins: input.daily.totalDailyWins ?? 0,
      currentStreak: input.daily.currentStreak ?? 0,
      bestStreak: input.daily.bestStreak ?? 0,
      lastCompletedDate: input.daily.lastCompletedDate ?? null,
      todayCompleted: isDailyCompleted(input.daily, todayKey),
      todayBestScore: input.daily.dailyBestScoreByDate?.[todayKey] ?? null,
    },
    hasData: totalAttempts > 0,
  };
}

export interface VerdictMessageInput {
  accuracy: number;
  avgWrong: number;
  attempts: number;
  /** 由介面層注入的翻譯函式。 */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

/**
 * 產生強弱項建議文字。
 * 規則集中在這裡（門檻常數在 types/analytics.ts），未來可調整。
 * 顯示文字交由 i18n 翻譯，並保持鼓勵且具體。
 */
export function formatVerdictMessage(
  label: string,
  stat: VerdictMessageInput,
): string {
  const { attempts, accuracy, avgWrong, t } = stat;
  if (attempts < MIN_ATTEMPTS_FOR_VERDICT) {
    return t("insufficientVerdict", { label, attempts, needed: MIN_ATTEMPTS_FOR_VERDICT });
  }
  const percent = Math.round(accuracy * 100);
  if (accuracy >= STRONG_ACCURACY && avgWrong < STRONG_AVG_WRONG) {
    return t("strongVerdict", { label, percent });
  }
  if (accuracy < WEAK_ACCURACY || avgWrong >= WEAK_AVG_WRONG) {
    return t("weakVerdict", { label, percent });
  }
  return t("practiceVerdict", { label, percent });
}

export function verdictLabel(verdict: CategoryStat["verdict"]): string {
  return VERDICT_LABELS[verdict];
}

export function verdictLabelKey(verdict: CategoryStat["verdict"]): TranslationKey {
  return VERDICT_LABEL_KEYS[verdict];
}
