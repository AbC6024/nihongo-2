import type {
  DailyRecord,
  GameMode,
  GameRecord,
  GameSettings,
  MistakeEntry,
  QuestionAttempt,
} from "../types/game";
import type { Difficulty } from "../types/question";
import { createDefaultProfile, sanitizeProfile, type PlayerProfile } from "./profile";
import { createEmptyDailyRecord } from "../utils/dailyChallenge";
import { canonicalCategories } from "../utils/categories";
import { DEFAULT_SETTINGS } from "../utils/settings";

export const STORAGE_SCHEMA_VERSION = 3;

export const STORAGE_KEYS = {
  meta: "niiki.meta",
  settings: "niiki.settings",
  mistakes: "niiki.mistakes",
  attempts: "niiki.attempts",
  games: "niiki.games",
  daily: "niiki.daily",
  customWords: "niiki.customWords",
  profile: "niiki.profile",
} as const;

interface MetaRecord {
  schemaVersion: number;
  createdAt: string;
}

export interface StorageSnapshot {
  settings: GameSettings;
  mistakes: Record<string, MistakeEntry>;
  attempts: QuestionAttempt[];
  games: GameRecord[];
  daily: DailyRecord;
  customWords: unknown[];
  profile: PlayerProfile;
  storageWarning: string | null;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeLocalStorage(): Storage | null {
  if (!isBrowser()) return null;
  try {
    const probe = "__niiki_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(key: string): string | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): boolean {
  const storage = safeLocalStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeRaw(key: string): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    // 內容損毀：移除並回退到預設值，避免整個遊戲無法啟動。
    removeRaw(key);
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const VALID_DIFFICULTIES = ["N5", "N4", "N3", "N2", "N1"];

function sanitizeSettings(raw: unknown): GameSettings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };
  const merged: GameSettings = { ...DEFAULT_SETTINGS };
  const duration = raw.duration;
  if (duration === 60 || duration === 120 || duration === 180) merged.duration = duration;
  if (raw.inputMethod === "romaji" || raw.inputMethod === "kana") {
    merged.inputMethod = raw.inputMethod;
  }
  // 語言：舊資料沒有此欄位時保留預設繁體中文，不影響其他既有設定。
  if (raw.language === "zh-TW" || raw.language === "ja" || raw.language === "en") {
    merged.language = raw.language;
  }
  if (Array.isArray(raw.difficulties)) {
    const filtered = raw.difficulties.filter((d): d is Difficulty =>
      VALID_DIFFICULTIES.includes(d as string),
    );
    merged.difficulties = filtered.length > 0 ? (filtered as Difficulty[]) : [...DEFAULT_SETTINGS.difficulties];
  }
  if (Array.isArray(raw.categories)) {
    // 舊版本存下的分類名（例如「交通」）會轉成新分類表（例如「交通與旅行」），
    // 避免升級後玩家原本的篩選設定突然失效。
    merged.categories = canonicalCategories(
      raw.categories.filter((c): c is string => typeof c === "string"),
    );
  }
  if (typeof raw.revealCorrectMs === "number" && raw.revealCorrectMs >= 200) {
    merged.revealCorrectMs = Math.min(raw.revealCorrectMs, 5000);
  }
  if (typeof raw.revealSkipMs === "number" && raw.revealSkipMs >= 200) {
    merged.revealSkipMs = Math.min(raw.revealSkipMs, 5000);
  }
  if (typeof raw.reviewRevealMs === "number" && raw.reviewRevealMs >= 1000) {
    merged.reviewRevealMs = Math.min(raw.reviewRevealMs, 60_000);
  }
  if (typeof raw.showImageHintDuringPlay === "boolean") {
    merged.showImageHintDuringPlay = raw.showImageHintDuringPlay;
  }
  if (raw.imageMode === "local" || raw.imageMode === "remote" || raw.imageMode === "disabled") {
    merged.imageMode = raw.imageMode;
  }
  if (typeof raw.useAudioFiles === "boolean") merged.useAudioFiles = raw.useAudioFiles;
  if (typeof raw.shortWordSlowSpeech === "boolean") {
    merged.shortWordSlowSpeech = raw.shortWordSlowSpeech;
  }
  if (typeof raw.speechBaseRate === "number" && Number.isFinite(raw.speechBaseRate)) {
    merged.speechBaseRate = Math.min(2, Math.max(0.1, raw.speechBaseRate));
  }
  if (typeof raw.shortWordMaxMora === "number" && Number.isFinite(raw.shortWordMaxMora)) {
    merged.shortWordMaxMora = Math.min(20, Math.max(0, Math.round(raw.shortWordMaxMora)));
  }
  if (
    typeof raw.shortWordRateMultiplier === "number" &&
    Number.isFinite(raw.shortWordRateMultiplier)
  ) {
    merged.shortWordRateMultiplier = Math.min(2, Math.max(0.1, raw.shortWordRateMultiplier));
  }
  if (typeof raw.sfxEnabled === "boolean") merged.sfxEnabled = raw.sfxEnabled;
  if (typeof raw.sfxVolume === "number" && Number.isFinite(raw.sfxVolume)) {
    merged.sfxVolume = Math.min(1, Math.max(0, raw.sfxVolume));
  }
  // 語音速度：只接受 1 或 0.5，其他值（含舊資料缺漏）回到正常速度。
  if (raw.speechSpeed === 1 || raw.speechSpeed === 0.5) {
    merged.speechSpeed = raw.speechSpeed;
  }
  return merged;
}

const VALID_MODES: GameMode[] = ["word", "sentence", "review", "daily"];

function isMistakeEntry(value: unknown): value is MistakeEntry {
  return (
    isRecord(value) &&
    typeof value.questionId === "string" &&
    typeof value.wrongCount === "number" &&
    typeof value.starred === "boolean" &&
    VALID_MODES.includes(value.mode as GameMode)
  );
}

function sanitizeMistakes(raw: unknown): Record<string, MistakeEntry> {
  if (!isRecord(raw)) return {};
  const result: Record<string, MistakeEntry> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isMistakeEntry(value)) {
      result[value.questionId || key] = {
        questionId: value.questionId,
        mode: value.mode,
        wrongCount: Math.max(0, Math.floor(value.wrongCount)),
        skipCount: Math.max(0, Math.floor(Number(value.skipCount) || 0)),
        reviewCount: Math.max(0, Math.floor(Number(value.reviewCount) || 0)),
        starred: Boolean(value.starred),
        firstWrongAt: typeof value.firstWrongAt === "string" ? value.firstWrongAt : new Date().toISOString(),
        lastWrongAt: typeof value.lastWrongAt === "string" ? value.lastWrongAt : new Date().toISOString(),
        lastReviewedAt:
          typeof value.lastReviewedAt === "string" ? value.lastReviewedAt : undefined,
      };
    }
  }
  return result;
}

function isAttempt(value: unknown): value is QuestionAttempt {
  return (
    isRecord(value) &&
    typeof value.questionId === "string" &&
    typeof value.timestamp === "string" &&
    VALID_DIFFICULTIES.includes(value.difficulty as string) &&
    typeof value.correct === "boolean"
  );
}

function sanitizeAttempts(raw: unknown): QuestionAttempt[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isAttempt).map((attempt) => ({
    ...attempt,
    localDate:
      typeof attempt.localDate === "string" ? attempt.localDate : attempt.timestamp.slice(0, 10),
    category: typeof attempt.category === "string" ? attempt.category : "未分類",
    wrongAttempts: Math.max(0, Math.floor(Number(attempt.wrongAttempts) || 0)),
    skipped: Boolean(attempt.skipped),
    score: Number(attempt.score) || 0,
    responseTimeMs: Math.max(0, Number(attempt.responseTimeMs) || 0),
    inputMethod: attempt.inputMethod === "kana" ? "kana" : "romaji",
  }));
}

function isGameRecord(value: unknown): value is GameRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.startedAt === "string" &&
    typeof value.endedAt === "string" &&
    VALID_MODES.includes(value.gameMode as GameMode)
  );
}

function sanitizeGames(raw: unknown): GameRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isGameRecord).map((game) => ({
    ...game,
    localDate: typeof game.localDate === "string" ? game.localDate : game.endedAt.slice(0, 10),
    durationSeconds: Math.max(0, Number(game.durationSeconds) || 0),
    score: Number(game.score) || 0,
    answered: Math.max(0, Number(game.answered) || 0),
    correct: Math.max(0, Number(game.correct) || 0),
    wrong: Math.max(0, Number(game.wrong) || 0),
    skipped: Math.max(0, Number(game.skipped) || 0),
    accuracy: Number(game.accuracy) || 0,
  }));
}

function sanitizeDaily(raw: unknown): DailyRecord {
  const base = createEmptyDailyRecord();
  if (!isRecord(raw)) return base;
  const completedDates = Array.isArray(raw.completedDates)
    ? raw.completedDates.filter((d): d is string => typeof d === "string").sort()
    : [];
  const bestScores: Record<string, number> = {};
  if (isRecord(raw.dailyBestScoreByDate)) {
    for (const [key, value] of Object.entries(raw.dailyBestScoreByDate)) {
      if (typeof value === "number" && Number.isFinite(value)) bestScores[key] = value;
    }
  }
  const questionIds: Record<string, string[]> = {};
  if (isRecord(raw.lastDailyQuestionIds)) {
    for (const [key, value] of Object.entries(raw.lastDailyQuestionIds)) {
      if (Array.isArray(value)) {
        questionIds[key] = value.filter((id): id is string => typeof id === "string");
      }
    }
  }
  return {
    totalDailyWins: Math.max(0, Number(raw.totalDailyWins) || completedDates.length),
    currentStreak: Math.max(0, Number(raw.currentStreak) || 0),
    bestStreak: Math.max(0, Number(raw.bestStreak) || 0),
    lastCompletedDate:
      typeof raw.lastCompletedDate === "string"
        ? raw.lastCompletedDate
        : completedDates.length > 0
          ? completedDates[completedDates.length - 1]
          : null,
    completedDates,
    dailyBestScoreByDate: bestScores,
    lastDailyQuestionIds: questionIds,
  };
}

/**
 * 讀取所有資料並執行 schema 遷移。
 * - 版本號低於 SCHEMA_VERSION 時執行遷移
 * - 單一 key 損毀時安全地重建該 key，不影響其他資料
 * - localStorage 不可用時回傳記憶體內的預設資料，遊戲仍可進行（但不保存）
 */
export function loadSnapshot(): StorageSnapshot {
  const meta = readJson<MetaRecord | null>(STORAGE_KEYS.meta, null);
  let storageWarning: string | null = null;

  if (!isBrowser()) {
    storageWarning = "目前環境無法使用瀏覽器儲存空間，遊玩紀錄不會被保存。";
  } else if (!safeLocalStorage()) {
    storageWarning = "瀏覽器儲存空間無法寫入，遊玩紀錄不會被保存。";
  } else if (!meta) {
    writeJson(STORAGE_KEYS.meta, {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
    } satisfies MetaRecord);
  } else if ((meta.schemaVersion ?? 0) < STORAGE_SCHEMA_VERSION) {
    migrateSchema(meta.schemaVersion ?? 0);
  }

  return {
    settings: sanitizeSettings(readJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS)),
    mistakes: sanitizeMistakes(readJson(STORAGE_KEYS.mistakes, {})),
    attempts: sanitizeAttempts(readJson(STORAGE_KEYS.attempts, [])),
    games: sanitizeGames(readJson(STORAGE_KEYS.games, [])),
    daily: sanitizeDaily(readJson(STORAGE_KEYS.daily, createEmptyDailyRecord())),
    customWords: readJson<unknown[]>(STORAGE_KEYS.customWords, []),
    profile: sanitizeProfile(readJson<PlayerProfile | null>(STORAGE_KEYS.profile, null) ?? createDefaultProfile()),
    storageWarning,
  };
}

/**
 * 執行 schema 遷移。
 * @param _fromVersion 讀取時的 schema 版本（保留參數以便日後依版本分派）
 */
function migrateSchema(_fromVersion: number): void {
  // v1 → v2：錯題本由陣列改為以 questionId 為 key 的物件。
  const legacyMistakes = readJson<unknown>(STORAGE_KEYS.mistakes, null);
  if (Array.isArray(legacyMistakes)) {
    const migrated: Record<string, MistakeEntry> = {};
    for (const item of legacyMistakes) {
      if (isRecord(item) && typeof item.questionId === "string") {
        migrated[item.questionId] = {
          questionId: item.questionId,
          mode: VALID_MODES.includes(item.mode as GameMode) ? (item.mode as GameMode) : "word",
          wrongCount: Math.max(1, Math.floor(Number(item.wrongCount) || 1)),
          skipCount: Math.max(0, Math.floor(Number(item.skipCount) || 0)),
          reviewCount: Math.max(0, Math.floor(Number(item.reviewCount) || 0)),
          starred: Boolean(item.starred),
          firstWrongAt: typeof item.firstWrongAt === "string" ? item.firstWrongAt : new Date().toISOString(),
          lastWrongAt: typeof item.lastWrongAt === "string" ? item.lastWrongAt : new Date().toISOString(),
        };
      }
    }
    writeJson(STORAGE_KEYS.mistakes, migrated);
  }

  // v2 → v3：補上 daily.bestStreak / daily.completedDates。
  const legacyDaily = readJson<Record<string, unknown> | null>(STORAGE_KEYS.daily, null);
  if (legacyDaily && !Array.isArray(legacyDaily.completedDates)) {
    const bestScores = isRecord(legacyDaily.dailyBestScoreByDate) ? legacyDaily.dailyBestScoreByDate : {};
    const completedDates = Object.keys(bestScores)
      .filter((key) => typeof bestScores[key] === "number")
      .sort();
    writeJson(STORAGE_KEYS.daily, {
      ...legacyDaily,
      totalDailyWins: Number(legacyDaily.totalDailyWins) || completedDates.length,
      completedDates,
      currentStreak: Number(legacyDaily.currentStreak) || 0,
      bestStreak: Math.max(Number(legacyDaily.bestStreak) || 0, Number(legacyDaily.currentStreak) || 0),
    });
  }

  writeJson(STORAGE_KEYS.meta, {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    createdAt: meta_createdAt(),
  } satisfies MetaRecord);

  function meta_createdAt(): string {
    return new Date().toISOString();
  }
}

export function saveSettings(settings: GameSettings): boolean {
  return writeJson(STORAGE_KEYS.settings, settings);
}

export function saveMistakes(mistakes: Record<string, MistakeEntry>): boolean {
  return writeJson(STORAGE_KEYS.mistakes, mistakes);
}

export function saveAttempts(attempts: QuestionAttempt[]): boolean {
  return writeJson(STORAGE_KEYS.attempts, attempts);
}

export function saveGames(games: GameRecord[]): boolean {
  return writeJson(STORAGE_KEYS.games, games);
}

export function saveDaily(daily: DailyRecord): boolean {
  return writeJson(STORAGE_KEYS.daily, daily);
}

export function saveCustomWords(words: unknown[]): boolean {
  return writeJson(STORAGE_KEYS.customWords, words);
}

export function saveProfile(profile: PlayerProfile): boolean {
  return writeJson(STORAGE_KEYS.profile, profile);
}

export function clearAllGameData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => removeRaw(key));
}

export function describeStorageUsage(): {
  keys: { key: string; bytes: number }[];
  totalBytes: number;
} {
  const storage = safeLocalStorage();
  const keys: { key: string; bytes: number }[] = [];
  let totalBytes = 0;
  if (storage) {
    for (const key of Object.values(STORAGE_KEYS)) {
      const raw = readRaw(key);
      if (raw) {
        const bytes = new Blob([raw]).size;
        keys.push({ key, bytes });
        totalBytes += bytes;
      }
    }
  }
  return { keys, totalBytes };
}