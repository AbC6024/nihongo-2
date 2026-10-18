import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DailyRecord, GameRecord, GameSettings, MistakeEntry, QuestionAttempt } from "../types/game";
import type { WordQuestion } from "../types/question";
import { BUILTIN_WORDS } from "../data/words";
import { warmUpSfx } from "../services/sfx";
import { serializeBackup, mergeBackup, type BackupSource } from "../services/backup";
import {
  createDefaultProfile,
  sanitizeProfile,
  setBuiltinAvatar,
  setCustomAvatar,
  setNickname,
  type PlayerProfile,
} from "../services/profile";
import {
  saveProfile,
} from "../services/storage";

export const APP_VERSION = "1.0.0";

export interface BackupImportSummary {
  mistakes: number;
  attempts: number;
  games: number;
  completedDates: number;
}
import {
  clearAllGameData,
  loadSnapshot,
  saveAttempts,
  saveCustomWords,
  saveDaily,
  saveGames,
  saveMistakes,
  saveSettings,
} from "../services/storage";

const MAX_ATTEMPTS = 5000;
const MAX_GAMES = 500;

export interface AppStore {
  ready: boolean;
  storageWarning: string | null;
  settings: GameSettings;
  mistakes: Record<string, MistakeEntry>;
  attempts: QuestionAttempt[];
  games: GameRecord[];
  daily: DailyRecord;
  customWords: WordQuestion[];
  allWords: WordQuestion[];
  updateSettings: (patch: Partial<GameSettings>) => void;
  recordAttempt: (attempt: QuestionAttempt) => void;
  recordGame: (record: GameRecord) => void;
  registerWrong: (questionId: string, mode: MistakeEntry["mode"], skipped: boolean) => void;
  markReviewed: (questionId: string) => void;
  toggleStar: (questionId: string) => void;
  removeMistake: (questionId: string) => void;
  clearMistakes: () => void;
  updateDaily: (record: DailyRecord) => void;
  /** 玩家個人檔案（暱稱 + 頭像）。 */
  profile: PlayerProfile;
  updateNickname: (nickname: string) => void;
  selectAvatar: (avatarId: string) => void;
  uploadAvatar: (dataUrl: string | null) => void;
  addCustomWords: (words: WordQuestion[]) => void;
  clearCustomWords: () => void;
  resetEverything: () => void;
  /** 匯出本機資料為備份檔內容（JSON 字串）。 */
  exportBackup: () => string;
  /** 合併／覆蓋匯入備份資料；回傳匯入後各項筆數。 */
  importBackup: (payload: BackupSource, mode: "merge" | "replace") => BackupImportSummary;
}

const StoreContext = createContext<AppStore | null>(null);

function sanitizeCustomWords(raw: unknown[]): WordQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is WordQuestion =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as WordQuestion).id === "string" &&
      typeof (item as WordQuestion).japanese === "string",
  );
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [mistakes, setMistakes] = useState<Record<string, MistakeEntry>>({});
  const [attempts, setAttempts] = useState<QuestionAttempt[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [daily, setDaily] = useState<DailyRecord | null>(null);
  const [customWords, setCustomWords] = useState<WordQuestion[]>([]);
  const [profile, setProfile] = useState<PlayerProfile>(() => createDefaultProfile());

  useEffect(() => {
    const snapshot = loadSnapshot();
    setSettings(snapshot.settings);
    setMistakes(snapshot.mistakes);
    setAttempts(snapshot.attempts);
    setGames(snapshot.games);
    setDaily(snapshot.daily);
    setCustomWords(sanitizeCustomWords(snapshot.customWords));
    setProfile(sanitizeProfile(snapshot.profile));
    setStorageWarning(snapshot.storageWarning);
    setReady(true);
    // 使用者第一次互動時暖機 Web Audio，降低首次答題音效被瀏覽器阻擋的機率。
    warmUpSfx();
  }, []);

  const updateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const recordAttempt = useCallback((attempt: QuestionAttempt) => {
    setAttempts((prev) => {
      const next = [...prev, attempt].slice(-MAX_ATTEMPTS);
      saveAttempts(next);
      return next;
    });
  }, []);

  const recordGame = useCallback((record: GameRecord) => {
    setGames((prev) => {
      // 同一局遊戲只會有一筆紀錄：以 id 去重，
      // 避免重複結算／重新渲染造成累積分數或最高分數被灌水。
      if (prev.some((item) => item.id === record.id)) return prev;
      const next = [...prev, record].slice(-MAX_GAMES);
      saveGames(next);
      return next;
    });
  }, []);

  const registerWrong = useCallback(
    (questionId: string, mode: MistakeEntry["mode"], skipped: boolean) => {
      setMistakes((prev) => {
        const now = new Date().toISOString();
        const existing = prev[questionId];
        const next: Record<string, MistakeEntry> = {
          ...prev,
          [questionId]: {
            questionId,
            mode,
            wrongCount: (existing?.wrongCount ?? 0) + 1,
            skipCount: (existing?.skipCount ?? 0) + (skipped ? 1 : 0),
            reviewCount: existing?.reviewCount ?? 0,
            starred: existing?.starred ?? false,
            firstWrongAt: existing?.firstWrongAt ?? now,
            lastWrongAt: now,
            lastReviewedAt: existing?.lastReviewedAt,
          },
        };
        saveMistakes(next);
        return next;
      });
    },
    [],
  );

  const markReviewed = useCallback((questionId: string) => {
    setMistakes((prev) => {
      const existing = prev[questionId];
      if (!existing) return prev;
      const next: Record<string, MistakeEntry> = {
        ...prev,
        [questionId]: {
          ...existing,
          reviewCount: existing.reviewCount + 1,
          lastReviewedAt: new Date().toISOString(),
        },
      };
      saveMistakes(next);
      return next;
    });
  }, []);

  const toggleStar = useCallback((questionId: string) => {
    setMistakes((prev) => {
      const existing = prev[questionId];
      if (!existing) return prev;
      const next: Record<string, MistakeEntry> = {
        ...prev,
        [questionId]: { ...existing, starred: !existing.starred },
      };
      saveMistakes(next);
      return next;
    });
  }, []);

  const removeMistake = useCallback((questionId: string) => {
    setMistakes((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      // 只刪除錯題本項目，不動 attempts / games 等遊玩歷史。
      delete next[questionId];
      saveMistakes(next);
      return next;
    });
  }, []);

  const clearMistakes = useCallback(() => {
    setMistakes(() => {
      saveMistakes({});
      return {};
    });
  }, []);

  const updateDaily = useCallback((record: DailyRecord) => {
    setDaily((prev) => {
      const base = prev ?? record;
      saveDaily(record);
      return { ...base, ...record };
    });
  }, []);

  const addCustomWords = useCallback((words: WordQuestion[]) => {
    setCustomWords((prev) => {
      const next = [...prev, ...words];
      saveCustomWords(next);
      return next;
    });
  }, []);

  const clearCustomWords = useCallback(() => {
    setCustomWords(() => {
      saveCustomWords([]);
      return [];
    });
  }, []);

  const resetEverything = useCallback(() => {
    clearAllGameData();
    const snapshot = loadSnapshot();
    setSettings(snapshot.settings);
    setMistakes({});
    setAttempts([]);
    setGames([]);
    setDaily(snapshot.daily);
    setCustomWords([]);
    setStorageWarning(snapshot.storageWarning);
  }, []);

  const exportBackup = useCallback(() => {
    if (!settings || !daily) return "";
    return serializeBackup(
      { settings, mistakes, attempts, games, daily },
      APP_VERSION,
    );
  }, [settings, mistakes, attempts, games, daily]);

  const importBackup = useCallback(
    (payload: BackupSource, mode: "merge" | "replace"): BackupImportSummary => {
      if (!settings || !daily) {
        return { mistakes: 0, attempts: 0, games: 0, completedDates: 0 };
      }
      const current: BackupSource = { settings, mistakes, attempts, games, daily };
      const next: BackupSource = mode === "replace" ? payload : mergeBackup(current, payload);

      saveSettings(next.settings);
      saveMistakes(next.mistakes);
      saveAttempts(next.attempts);
      saveGames(next.games);
      saveDaily(next.daily);

      setSettings(next.settings);
      setMistakes(next.mistakes);
      setAttempts(next.attempts);
      setGames(next.games);
      setDaily(next.daily);

      return {
        mistakes: Object.keys(next.mistakes).length,
        attempts: next.attempts.length,
        games: next.games.length,
        completedDates: next.daily.completedDates.length,
      };
    },
    [settings, mistakes, attempts, games, daily],
  );

  const updateNickname = useCallback((nickname: string) => {
    setProfile((prev) => {
      const next = setNickname(prev, nickname);
      saveProfile(next);
      return next;
    });
  }, []);

  const selectAvatar = useCallback((avatarId: string) => {
    setProfile((prev) => {
      const next = setBuiltinAvatar(prev, avatarId);
      saveProfile(next);
      return next;
    });
  }, []);

  const uploadAvatar = useCallback((dataUrl: string | null) => {
    setProfile((prev) => {
      const next = setCustomAvatar(prev, dataUrl);
      saveProfile(next);
      return next;
    });
  }, []);

  const allWords = useMemo(() => {
    const builtinIds = new Set(BUILTIN_WORDS.map((word) => word.id));
    return [...BUILTIN_WORDS, ...customWords.filter((word) => !builtinIds.has(word.id))];
  }, [customWords]);

  const value = useMemo<AppStore | null>(() => {
    if (!ready || !settings || !daily) return null;
    return {
      ready,
      storageWarning,
      settings,
      mistakes,
      attempts,
      games,
      daily,
      customWords,
      profile,
      updateNickname,
      selectAvatar,
      uploadAvatar,
      allWords,
      updateSettings,
      recordAttempt,
      recordGame,
      registerWrong,
      markReviewed,
      toggleStar,
      removeMistake,
      clearMistakes,
      updateDaily,
      addCustomWords,
      clearCustomWords,
      resetEverything,
      exportBackup,
      importBackup,
    };
  }, [
    ready,
    storageWarning,
    settings,
    mistakes,
    attempts,
    games,
    daily,
    customWords,
    profile,
    updateNickname,
    selectAvatar,
    uploadAvatar,
    allWords,
    updateSettings,
    recordAttempt,
    recordGame,
    registerWrong,
    markReviewed,
    toggleStar,
    removeMistake,
    clearMistakes,
    updateDaily,
    addCustomWords,
    clearCustomWords,
    resetEverything,
    exportBackup,
    importBackup,
  ]);

  if (!value) {
    return <div className="empty">讀取資料中…</div>;
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useAppStore 必須在 AppStoreProvider 內使用");
  return store;
}