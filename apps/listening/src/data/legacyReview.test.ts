import { describe, expect, it } from "vitest";
import { questionsForReview } from "./legacyReview";
import { MINNA_WORDS } from "./minnaBankLoaded";
import { loadSnapshot, STORAGE_KEYS } from "../services/storage";
import type { MistakeEntry } from "../types/game";

const mistake = (questionId: string): MistakeEntry => ({
  questionId, mode: "word", wrongCount: 2, skipCount: 0, reviewCount: 1,
  starred: true, firstWrongAt: "2026-10-18T00:00:00Z", lastWrongAt: "2026-10-18T00:00:00Z"
});

describe("upgrading the existing listening game", () => {
  it("keeps the new lesson bank separate from retired questions", () => {
    expect(questionsForReview(MINNA_WORDS, {})).toEqual(MINNA_WORDS);
  });

  it("resolves both old word and sentence mistakes without dropping their history", () => {
    const mistakes = { "w-cwy5ka": mistake("w-cwy5ka"), "s-ramen-kinou": { ...mistake("s-ramen-kinou"), mode: "sentence" as const } };
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEYS.mistakes, JSON.stringify(mistakes));
    const loaded = loadSnapshot();
    expect(loaded.mistakes).toEqual(mistakes);
    const review = questionsForReview(MINNA_WORDS, loaded.mistakes);
    expect(review.find(q => q.id === "w-cwy5ka")).toMatchObject({ japanese: "猫", kana: "ねこ" });
    expect(review.find(q => q.id === "s-ramen-kinou")).toHaveProperty("sentence");
    expect(review).toHaveLength(MINNA_WORDS.length + 2);
    expect(window.localStorage.getItem(STORAGE_KEYS.mistakes)).toBe(JSON.stringify(mistakes));
  });
});
