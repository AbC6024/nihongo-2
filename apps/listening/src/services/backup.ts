import type {
  DailyRecord,
  GameRecord,
  GameSettings,
  MistakeEntry,
  QuestionAttempt,
} from "../types/game";
import { createEmptyDailyRecord } from "../utils/dailyChallenge";
import { DEFAULT_SETTINGS } from "../utils/settings";

/**
 * 本機資料備份（JSON 匯出／匯入）。
 *
 * 目的：
 * - 桌面版與手機網頁版的 localStorage **不會**自動同步。
 *   玩家可以用這個功能在裝置之間手動轉移錯題本、設定與遊玩紀錄。
 * - 這不是雲端同步，只是檔案層級的備份／還原。
 *
 * 安全：
 * - 匯入前逐欄位驗證與清理，格式錯誤不會寫入破壞既有資料。
 * - 匯入預設為「合併」，不會直接清空玩家現有資料；
 *   若要整份覆蓋需明確指定 replace。
 */

export const BACKUP_FORMAT = "niiki-board-backup";
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
  counts: {
    settings: number;
    mistakes: number;
    attempts: number;
    games: number;
  };
  data: {
    settings: GameSettings;
    mistakes: Record<string, MistakeEntry>;
    attempts: QuestionAttempt[];
    games: GameRecord[];
    daily: DailyRecord;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeSettings(raw: unknown): GameSettings {
  const merged: GameSettings = { ...DEFAULT_SETTINGS };
  if (!isRecord(raw)) return merged;
  if (raw.duration === 60 || raw.duration === 120 || raw.duration === 180) merged.duration = raw.duration;
  if (raw.inputMethod === "romaji" || raw.inputMethod === "kana") merged.inputMethod = raw.inputMethod;
  if (raw.language === "zh-TW" || raw.language === "ja" || raw.language === "en") {
    merged.language = raw.language;
  }
  if (Array.isArray(raw.difficulties)) {
    const filtered = raw.difficulties.filter((d): d is GameSettings["difficulties"][number] =>
      ["N5", "N4", "N3", "N2", "N1"].includes(String(d)),
    );
    if (filtered.length > 0) merged.difficulties = filtered;
  }
  if (Array.isArray(raw.categories)) {
    merged.categories = raw.categories.filter((c): c is string => typeof c === "string");
  }
  if (typeof raw.sfxEnabled === "boolean") merged.sfxEnabled = raw.sfxEnabled;
  if (typeof raw.sfxVolume === "number" && Number.isFinite(raw.sfxVolume)) {
    merged.sfxVolume = Math.min(1, Math.max(0, raw.sfxVolume));
  }
  if (raw.speechSpeed === 1 || raw.speechSpeed === 0.5) {
    merged.speechSpeed = raw.speechSpeed;
  }
  if (typeof raw.shortWordSlowSpeech === "boolean") merged.shortWordSlowSpeech = raw.shortWordSlowSpeech;
  if (typeof raw.speechBaseRate === "number" && Number.isFinite(raw.speechBaseRate)) {
    merged.speechBaseRate = Math.min(2, Math.max(0.1, raw.speechBaseRate));
  }
  if (typeof raw.shortWordMaxMora === "number" && Number.isFinite(raw.shortWordMaxMora)) {
    merged.shortWordMaxMora = Math.min(20, Math.max(0, Math.round(raw.shortWordMaxMora)));
  }
  if (typeof raw.shortWordRateMultiplier === "number" && Number.isFinite(raw.shortWordRateMultiplier)) {
    merged.shortWordRateMultiplier = Math.min(2, Math.max(0.1, raw.shortWordRateMultiplier));
  }
  if (typeof raw.useAudioFiles === "boolean") merged.useAudioFiles = raw.useAudioFiles;
  if (typeof raw.showImageHintDuringPlay === "boolean") {
    merged.showImageHintDuringPlay = raw.showImageHintDuringPlay;
  }
  if (raw.imageMode === "local" || raw.imageMode === "remote" || raw.imageMode === "disabled") {
    merged.imageMode = raw.imageMode;
  }
  return merged;
}

function sanitizeMistakes(raw: unknown): Record<string, MistakeEntry> {
  const out: Record<string, MistakeEntry> = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value) || typeof value.questionId !== "string") continue;
    out[value.questionId || key] = {
      questionId: value.questionId || key,
      mode: ["word", "sentence", "review", "daily"].includes(String(value.mode))
        ? (value.mode as MistakeEntry["mode"])
        : "word",
      wrongCount: Math.max(0, Math.floor(asNumber(value.wrongCount))),
      skipCount: Math.max(0, Math.floor(asNumber(value.skipCount))),
      reviewCount: Math.max(0, Math.floor(asNumber(value.reviewCount))),
      starred: Boolean(value.starred),
      firstWrongAt: asString(value.firstWrongAt, new Date().toISOString()),
      lastWrongAt: asString(value.lastWrongAt, new Date().toISOString()),
      lastReviewedAt: value.lastReviewedAt ? asString(value.lastReviewedAt) : undefined,
    };
  }
  return out;
}

function sanitizeAttempts(raw: unknown): QuestionAttempt[] {
  if (!Array.isArray(raw)) return [];
  const out: QuestionAttempt[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.questionId !== "string" || typeof item.timestamp !== "string") {
      continue;
    }
    if (!["N5", "N4", "N3", "N2", "N1"].includes(String(item.difficulty))) continue;
    out.push({
      timestamp: item.timestamp,
      localDate: asString(item.localDate, item.timestamp.slice(0, 10)),
      gameMode: ["word", "sentence", "review", "daily"].includes(String(item.gameMode))
        ? (item.gameMode as QuestionAttempt["gameMode"])
        : "word",
      questionId: item.questionId,
      difficulty: item.difficulty as QuestionAttempt["difficulty"],
      category: asString(item.category, "未分類"),
      correct: Boolean(item.correct),
      wrongAttempts: Math.max(0, Math.floor(asNumber(item.wrongAttempts))),
      skipped: Boolean(item.skipped),
      score: asNumber(item.score),
      responseTimeMs: Math.max(0, asNumber(item.responseTimeMs)),
      inputMethod: item.inputMethod === "kana" ? "kana" : "romaji",
    });
  }
  return out;
}

function sanitizeGames(raw: unknown): GameRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: GameRecord[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    if (typeof item.startedAt !== "string" || typeof item.endedAt !== "string") continue;
    out.push({
      id: item.id,
      startedAt: item.startedAt,
      endedAt: item.endedAt,
      localDate: asString(item.localDate, item.endedAt.slice(0, 10)),
      gameMode: ["word", "sentence", "review", "daily"].includes(String(item.gameMode))
        ? (item.gameMode as GameRecord["gameMode"])
        : "word",
      durationSeconds: Math.max(0, asNumber(item.durationSeconds)),
      score: asNumber(item.score),
      answered: Math.max(0, Math.floor(asNumber(item.answered))),
      correct: Math.max(0, Math.floor(asNumber(item.correct))),
      wrong: Math.max(0, Math.floor(asNumber(item.wrong))),
      skipped: Math.max(0, Math.floor(asNumber(item.skipped))),
      accuracy: asNumber(item.accuracy),
    });
  }
  return out;
}

function sanitizeDaily(raw: unknown): DailyRecord {
  const base = createEmptyDailyRecord();
  if (!isRecord(raw)) return base;
  const completedDates = Array.isArray(raw.completedDates)
    ? raw.completedDates.filter((d): d is string => typeof d === "string").sort()
    : [];
  const dailyBestScoreByDate: Record<string, number> = {};
  if (isRecord(raw.dailyBestScoreByDate)) {
    for (const [key, value] of Object.entries(raw.dailyBestScoreByDate)) {
      if (typeof value === "number" && Number.isFinite(value)) dailyBestScoreByDate[key] = value;
    }
  }
  const lastDailyQuestionIds: Record<string, string[]> = {};
  if (isRecord(raw.lastDailyQuestionIds)) {
    for (const [key, value] of Object.entries(raw.lastDailyQuestionIds)) {
      if (Array.isArray(value)) {
        lastDailyQuestionIds[key] = value.filter((id): id is string => typeof id === "string");
      }
    }
  }
  return {
    totalDailyWins: Math.max(0, Math.floor(asNumber(raw.totalDailyWins))),
    currentStreak: Math.max(0, Math.floor(asNumber(raw.currentStreak))),
    bestStreak: Math.max(0, Math.floor(asNumber(raw.bestStreak))),
    lastCompletedDate: raw.lastCompletedDate ? asString(raw.lastCompletedDate) : null,
    completedDates,
    dailyBestScoreByDate,
    lastDailyQuestionIds,
  };
}

export interface BackupSource {
  settings: GameSettings;
  mistakes: Record<string, MistakeEntry>;
  attempts: QuestionAttempt[];
  games: GameRecord[];
  daily: DailyRecord;
}

/** 建立可下載的備份物件。 */
export function createBackup(source: BackupSource, appVersion = "1.0.0"): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    counts: {
      settings: Object.keys(source.settings).length,
      mistakes: Object.keys(source.mistakes).length,
      attempts: source.attempts.length,
      games: source.games.length,
    },
    data: {
      settings: source.settings,
      mistakes: source.mistakes,
      attempts: source.attempts,
      games: source.games,
      daily: source.daily,
    },
  };
}

export function serializeBackup(source: BackupSource, appVersion = "1.0.0"): string {
  return JSON.stringify(createBackup(source, appVersion), null, 2);
}

export interface BackupParseResult {
  ok: boolean;
  error: string | null;
  data: BackupSource | null;
  exportedAt: string | null;
  counts: BackupFile["counts"] | null;
}

export function parseBackup(text: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "不是有效的 JSON 檔案", data: null, exportedAt: null, counts: null };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: "備份檔格式不正確", data: null, exportedAt: null, counts: null };
  }
  if (parsed.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      error: `不是《聞いボード》的備份檔（format = ${String(parsed.format)}）`,
      data: null,
      exportedAt: null,
      counts: null,
    };
  }
  const version = asNumber(parsed.version, 0);
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `備份檔版本較新（v${version}），請先更新遊戲`,
      data: null,
      exportedAt: null,
      counts: null,
    };
  }
  const payload = isRecord(parsed.data) ? parsed.data : {};
  return {
    ok: true,
    error: null,
    exportedAt: asString(parsed.exportedAt, ""),
    counts: isRecord(parsed.counts)
      ? {
          settings: asNumber(parsed.counts.settings),
          mistakes: asNumber(parsed.counts.mistakes),
          attempts: asNumber(parsed.counts.attempts),
          games: asNumber(parsed.counts.games),
        }
      : null,
    data: {
      settings: sanitizeSettings(payload.settings),
      mistakes: sanitizeMistakes(payload.mistakes),
      attempts: sanitizeAttempts(payload.attempts),
      games: sanitizeGames(payload.games),
      daily: sanitizeDaily(payload.daily),
    },
  };
}

/** 合併錯題：保留較高的次數與星號，並取較早的 firstWrongAt。 */
function mergeMistakes(
  current: Record<string, MistakeEntry>,
  incoming: Record<string, MistakeEntry>,
): Record<string, MistakeEntry> {
  const merged: Record<string, MistakeEntry> = { ...current };
  for (const [id, entry] of Object.entries(incoming)) {
    const existing = merged[id];
    if (!existing) {
      merged[id] = entry;
      continue;
    }
    merged[id] = {
      ...existing,
      wrongCount: Math.max(existing.wrongCount, entry.wrongCount),
      skipCount: Math.max(existing.skipCount, entry.skipCount),
      reviewCount: Math.max(existing.reviewCount, entry.reviewCount),
      starred: existing.starred || entry.starred,
      firstWrongAt:
        existing.firstWrongAt < entry.firstWrongAt ? existing.firstWrongAt : entry.firstWrongAt,
      lastWrongAt:
        existing.lastWrongAt > entry.lastWrongAt ? existing.lastWrongAt : entry.lastWrongAt,
    };
  }
  return merged;
}

function mergeDaily(current: DailyRecord, incoming: DailyRecord): DailyRecord {
  const completedDates = Array.from(
    new Set([...(current.completedDates ?? []), ...(incoming.completedDates ?? [])]),
  ).sort();
  const dailyBestScoreByDate = { ...(current.dailyBestScoreByDate ?? {}) };
  for (const [date, score] of Object.entries(incoming.dailyBestScoreByDate ?? {})) {
    dailyBestScoreByDate[date] = Math.max(dailyBestScoreByDate[date] ?? 0, score);
  }
  return {
    totalDailyWins: Math.max(current.totalDailyWins ?? 0, incoming.totalDailyWins ?? 0),
    currentStreak: Math.max(current.currentStreak ?? 0, incoming.currentStreak ?? 0),
    bestStreak: Math.max(current.bestStreak ?? 0, incoming.bestStreak ?? 0),
    lastCompletedDate:
      current.lastCompletedDate && incoming.lastCompletedDate
        ? current.lastCompletedDate > incoming.lastCompletedDate
          ? current.lastCompletedDate
          : incoming.lastCompletedDate
        : current.lastCompletedDate ?? incoming.lastCompletedDate ?? null,
    completedDates,
    dailyBestScoreByDate,
    lastDailyQuestionIds: {
      ...(current.lastDailyQuestionIds ?? {}),
      ...(incoming.lastDailyQuestionIds ?? {}),
    },
  };
}

/**
 * 合併兩份資料。
 * - mistakes 取較高的次數與星號聯集（不重複計算）
 * - attempts / games 取聯集（以 timestamp / id 去重）
 */
export function mergeBackup(current: BackupSource, incoming: BackupSource): BackupSource {
  const seenAttempts = new Set(current.attempts.map((item) => `${item.timestamp}|${item.questionId}|${item.gameMode}`));
  const attempts = current.attempts.slice();
  for (const attempt of incoming.attempts) {
    const key = `${attempt.timestamp}|${attempt.questionId}|${attempt.gameMode}`;
    if (seenAttempts.has(key)) continue;
    seenAttempts.add(key);
    attempts.push(attempt);
  }
  attempts.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const seenGames = new Set(current.games.map((game) => game.id));
  const games = current.games.slice();
  for (const game of incoming.games) {
    if (seenGames.has(game.id)) continue;
    seenGames.add(game.id);
    games.push(game);
  }
  games.sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  return {
    settings: incoming.settings,
    mistakes: mergeMistakes(current.mistakes, incoming.mistakes),
    attempts,
    games,
    daily: mergeDaily(current.daily, incoming.daily),
  };
}

/** 觸發瀏覽器下載。桌面版與手機版都適用。 */
export function downloadBackupFile(filename: string, content: string): boolean {
  try {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // 稍後再釋放，確保部分瀏覽器有時間開始下載。
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}