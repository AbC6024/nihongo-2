import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createBackup,
  mergeBackup,
  parseBackup,
  serializeBackup,
  type BackupSource,
} from "./backup";
import { createEmptyDailyRecord } from "../utils/dailyChallenge";
import { DEFAULT_SETTINGS } from "../utils/settings";
import type { MistakeEntry } from "../types/game";

function source(overrides: Partial<BackupSource> = {}): BackupSource {
  return {
    settings: { ...DEFAULT_SETTINGS },
    mistakes: {},
    attempts: [],
    games: [],
    daily: createEmptyDailyRecord(),
    ...overrides,
  };
}

function mistake(id: string, overrides: Partial<MistakeEntry> = {}): MistakeEntry {
  return {
    questionId: id,
    mode: "word",
    wrongCount: 1,
    skipCount: 0,
    reviewCount: 0,
    starred: false,
    firstWrongAt: "2026-01-01T00:00:00.000Z",
    lastWrongAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("createBackup / serializeBackup", () => {
  it("包含格式與版本資訊", () => {
    const backup = createBackup(source({ mistakes: { a: mistake("a") } }));
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.counts.mistakes).toBe(1);
    expect(backup.data.mistakes.a.wrongCount).toBe(1);
  });

  it("序列化後可以還原", () => {
    const json = serializeBackup(source({ mistakes: { a: mistake("a", { starred: true }) } }));
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.data?.mistakes.a.starred).toBe(true);
  });
});

describe("parseBackup 驗證", () => {
  it("拒絕非 JSON", () => {
    const result = parseBackup("{ not json");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("JSON");
  });

  it("拒絕格式不符的檔案", () => {
    const result = parseBackup(JSON.stringify({ format: "other-app", version: 1 }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("不是");
  });

  it("拒絕版本過新的檔案", () => {
    const result = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 5, data: {} }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("版本較新");
  });

  it("清理損壞的欄位而不是整份拒絕", () => {
    const json = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      data: {
        settings: { duration: 999, inputMethod: "bogus", language: "fr", sfxEnabled: true },
        mistakes: {
          good: { questionId: "good", mode: "word", wrongCount: 2, starred: true },
          bad: { notAQuestion: true },
        },
        attempts: [
          {
            timestamp: "2026-01-01T00:00:00.000Z",
            questionId: "a",
            difficulty: "N5",
            correct: true,
          },
          { garbage: true },
        ],
        games: [{ garbage: true }],
        daily: { currentStreak: 3, completedDates: ["2026-01-01"] },
      },
    });
    const result = parseBackup(json);
    expect(result.ok).toBe(true);
    expect(result.data?.settings.duration).toBe(DEFAULT_SETTINGS.duration);
    expect(result.data?.settings.inputMethod).toBe(DEFAULT_SETTINGS.inputMethod);
    expect(result.data?.settings.language).toBe(DEFAULT_SETTINGS.language);
    expect(Object.keys(result.data?.mistakes ?? {})).toEqual(["good"]);
    expect(result.data?.attempts).toHaveLength(1);
    expect(result.data?.games).toHaveLength(0);
    expect(result.data?.daily.currentStreak).toBe(3);
  });

  it("夾限 sfxVolume 範圍", () => {
    const json = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      data: { settings: { sfxVolume: 99 } },
    });
    expect(parseBackup(json).data?.settings.sfxVolume).toBe(1);
    const json2 = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      data: { settings: { sfxVolume: -5 } },
    });
    expect(parseBackup(json2).data?.settings.sfxVolume).toBe(0);
  });

  it("缺少 data 欄位時回傳安全的預設值", () => {
    const json = JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION });
    const result = parseBackup(json);
    expect(result.ok).toBe(true);
    expect(result.data?.mistakes).toEqual({});
    expect(result.data?.attempts).toEqual([]);
    expect(result.data?.settings.inputMethod).toBe(DEFAULT_SETTINGS.inputMethod);
  });
});

describe("mergeBackup", () => {
  it("錯題取次數較高者與星號聯集，不重複累加", () => {
    const current = source({
      mistakes: {
        a: mistake("a", { wrongCount: 5, starred: false }),
        b: mistake("b", { wrongCount: 1, starred: true }),
      },
    });
    const incoming = source({
      mistakes: {
        a: mistake("a", { wrongCount: 2, starred: true }),
        c: mistake("c", { wrongCount: 3 }),
      },
    });
    const merged = mergeBackup(current, incoming);
    expect(merged.mistakes.a.wrongCount).toBe(5);
    expect(merged.mistakes.a.starred).toBe(true);
    expect(merged.mistakes.b.wrongCount).toBe(1);
    expect(merged.mistakes.c.wrongCount).toBe(3);
    expect(Object.keys(merged.mistakes).sort()).toEqual(["a", "b", "c"]);
  });

  it("作答紀錄以時間戳＋題目去重", () => {
    const attempt = {
      timestamp: "2026-01-01T00:00:00.000Z",
      localDate: "2026-01-01",
      gameMode: "word" as const,
      questionId: "q1",
      difficulty: "N5" as const,
      category: "動物",
      correct: true,
      wrongAttempts: 0,
      skipped: false,
      score: 100,
      responseTimeMs: 1000,
      inputMethod: "romaji" as const,
    };
    const current = source({ attempts: [attempt] });
    const incoming = source({ attempts: [attempt, { ...attempt, questionId: "q2" }] });
    const merged = mergeBackup(current, incoming);
    expect(merged.attempts).toHaveLength(2);
  });

  it("每日挑戰取並集並保留較高連勝", () => {
    const current = source();
    const dailyCurrent = { ...createEmptyDailyRecord(), currentStreak: 5, bestStreak: 9, completedDates: ["2026-01-01"] };
    const dailyIncoming = { ...createEmptyDailyRecord(), currentStreak: 2, bestStreak: 4, completedDates: ["2026-01-02"] };
    const merged = mergeBackup(
      { ...current, daily: dailyCurrent },
      { ...current, daily: dailyIncoming },
    );
    expect(merged.daily.completedDates.sort()).toEqual(["2026-01-01", "2026-01-02"]);
    expect(merged.daily.currentStreak).toBe(5);
    expect(merged.daily.bestStreak).toBe(9);
  });

  it("每日最佳分數取較高者", () => {
    const base = createEmptyDailyRecord();
    const merged = mergeBackup(
      { ...source(), daily: { ...base, dailyBestScoreByDate: { "2026-01-01": 1800 } } },
      { ...source(), daily: { ...base, dailyBestScoreByDate: { "2026-01-01": 1200 } } },
    );
    expect(merged.daily.dailyBestScoreByDate["2026-01-01"]).toBe(1800);
  });

  it("設定以匯入的那一份為準", () => {
    const incoming = source({ settings: { ...DEFAULT_SETTINGS, inputMethod: "kana", language: "ja" } });
    const merged = mergeBackup(source(), incoming);
    expect(merged.settings.inputMethod).toBe("kana");
    expect(merged.settings.language).toBe("ja");
  });
});

describe("跨裝置轉移情境", () => {
  it("桌機 → 手機：手機完全沒有資料時可完整還原", () => {
    const desktop = source({
      mistakes: { a: mistake("a", { wrongCount: 4, starred: true }) },
    });
    const json = serializeBackup(desktop);
    const imported = parseBackup(json);
    expect(imported.ok).toBe(true);

    const phoneEmpty = source();
    const merged = mergeBackup(phoneEmpty, imported.data!);
    expect(merged.mistakes.a.wrongCount).toBe(4);
    expect(merged.mistakes.a.starred).toBe(true);
    expect(merged.settings.inputMethod).toBe(DEFAULT_SETTINGS.inputMethod);
  });

  it("兩邊都有資料時合併不會重複計算", () => {
    const desktop = source({ mistakes: { a: mistake("a", { wrongCount: 3 }) } });
    const phone = source({ mistakes: { a: mistake("a", { wrongCount: 2 }) } });
    const merged = mergeBackup(phone, parseBackup(serializeBackup(desktop)).data!);
    expect(Object.keys(merged.mistakes)).toHaveLength(1);
    expect(merged.mistakes.a.wrongCount).toBe(3);
  });
});