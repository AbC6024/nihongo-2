import type { Difficulty } from "./question";
import type { SpeechSpeedMultiplier } from "../utils/speechRate";

export type { Difficulty, ImageMode } from "./question";

/** 支援的介面語言。 */
export type LocaleCode = "zh-TW" | "ja" | "en";

export type GameMode = "word" | "sentence" | "review" | "daily";

export type InputMethod = "romaji" | "kana";

export type GameDuration = 60 | 120 | 180;

export type GameState =
  | "HOME"
  | "READY"
  | "PLAYING"
  | "ANSWERING"
  | "CORRECT"
  | "WRONG"
  | "ANSWER_REVEAL"
  | "SKIPPED"
  | "GAME_OVER"
  | "REVIEW"
  | "DAILY_CHALLENGE"
  | "ANALYTICS";

export interface QuestionAttempt {
  timestamp: string;
  localDate: string;
  gameMode: GameMode;
  questionId: string;
  difficulty: Difficulty;
  category: string;
  correct: boolean;
  wrongAttempts: number;
  skipped: boolean;
  score: number;
  responseTimeMs: number;
  inputMethod: InputMethod;
}

export interface GameRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  localDate: string;
  gameMode: GameMode;
  durationSeconds: number;
  score: number;
  answered: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
}

export interface MistakeEntry {
  questionId: string;
  mode: GameMode;
  wrongCount: number;
  skipCount: number;
  reviewCount: number;
  starred: boolean;
  firstWrongAt: string;
  lastWrongAt: string;
  lastReviewedAt?: string;
}

export interface DailyRecord {
  totalDailyWins: number;
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate: string | null;
  completedDates: string[];
  dailyBestScoreByDate: Record<string, number>;
  lastDailyQuestionIds: Record<string, string[]>;
}

export interface GameSettings {
  duration: GameDuration;
  inputMethod: InputMethod;
  /** 介面語言（zh-TW / ja / en）。 */
  language: LocaleCode;
  difficulties: Difficulty[];
  categories: string[];
  revealCorrectMs: number;
  revealSkipMs: number;
  reviewRevealMs: number;
  showImageHintDuringPlay: boolean;
  imageMode: "local" | "remote" | "disabled";
  useAudioFiles: boolean;
  /** 是否啟用「短單字放慢」語速規則。 */
  shortWordSlowSpeech: boolean;
  /** TTS 基準語速。 */
  speechBaseRate: number;
  /** 音拍數 <= 此值的單字套用慢速規則。 */
  shortWordMaxMora: number;
  /** 短單字語速倍率（乘上 speechBaseRate）。 */
  shortWordRateMultiplier: number;
  /** 答題提示音效開關（不影響題目日文語音）。 */
  sfxEnabled: boolean;
  /** 提示音效音量（0～1）。 */
  sfxVolume: number;
  /** 題目語音總倍率：1（正常）或 0.5（慢速）。 */
  speechSpeed: SpeechSpeedMultiplier;
}

export interface DailyResult {
  dateKey: string;
  score: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  currentStreak: number;
  bestStreak: number;
  isNewWin: boolean;
}