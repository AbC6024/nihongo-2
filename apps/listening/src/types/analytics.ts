export interface CategoryStat {
  key: string;
  label: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avgWrong: number;
  skipped: number;
  verdict: "strong" | "practice" | "weak" | "insufficient";
}

export interface LevelStat {
  difficulty: string;
  attempts: number;
  accuracy: number;
  avgWrong: number;
  verdict: CategoryStat["verdict"];
}

export interface ModeStat {
  mode: string;
  attempts: number;
  accuracy: number;
  avgWrong: number;
  skipped: number;
  verdict: CategoryStat["verdict"];
}

export interface AnalyticsSummary {
  totalGames: number;
  totalAttempts: number;
  totalCorrect: number;
  overallAccuracy: number;
  avgResponseTimeMs: number;
  avgWrongAttempts: number;
  totalSkipped: number;
  levelStats: LevelStat[];
  categoryStats: CategoryStat[];
  modeStats: ModeStat[];
  frequentWrong: { questionId: string; wrongCount: number; skipCount: number }[];
  frequentSkipped: { questionId: string; wrongCount: number; skipCount: number }[];
  starredCount: number;
  mistakeCount: number;
  today: { dateKey: string; attempts: number; correct: number; accuracy: number };
  dailyStreak: {
    totalDailyWins: number;
    currentStreak: number;
    bestStreak: number;
    lastCompletedDate: string | null;
    todayCompleted: boolean;
    todayBestScore: number | null;
  };
  hasData: boolean;
}

export const STRONG_ACCURACY = 0.85;
export const STRONG_AVG_WRONG = 1;
export const WEAK_ACCURACY = 0.7;
export const WEAK_AVG_WRONG = 1.5;
export const MIN_ATTEMPTS_FOR_VERDICT = 5;

export function classifyStat(attempts: number, accuracy: number, avgWrong: number): CategoryStat["verdict"] {
  if (attempts < MIN_ATTEMPTS_FOR_VERDICT) return "insufficient";
  if (accuracy >= STRONG_ACCURACY && avgWrong < STRONG_AVG_WRONG) return "strong";
  if (accuracy < WEAK_ACCURACY || avgWrong >= WEAK_AVG_WRONG) return "weak";
  return "practice";
}