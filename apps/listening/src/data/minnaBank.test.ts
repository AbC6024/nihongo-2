import { describe, expect, it } from "vitest";
import entries from "./minnaNoNihongo.json";
import { MINNA_WORDS, MINNA_LESSONS, WORDS_BY_LESSON, REMOVED_ENTRIES } from "./minnaBankLoaded";
import { filterQuestions } from "../utils/randomQuestion";

describe("the supplied updated lesson bank", () => {
  it("accounts for all 594 supplied entries and covers lessons 1 through 12", () => {
    expect(entries).toHaveLength(594);
    expect(MINNA_WORDS.length + REMOVED_ENTRIES.length).toBe(entries.length);
    expect(MINNA_WORDS.length).toBeGreaterThan(500);
    expect(MINNA_LESSONS.map(l => l.number)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(new Set(MINNA_WORDS.map(w => w.id)).size).toBe(MINNA_WORDS.length);
  });

  it("keeps supplied readings and meanings and never labels unverified accents as verified", () => {
    for (const word of MINNA_WORDS) {
      expect(entries.some(entry => entry.japanese.trim() === word.japanese && entry.reading.trim() === word.kana && entry.chinese.trim() === word.meaning)).toBe(true);
      expect(word.romaji).toBeTruthy();
      expect(word.kana).not.toMatch(/[～~〜]/);
      expect(word.accentVerified).toBe(false);
      expect(word.accentPattern).toBeNull();
    }
  });

  it("draws only from selected lessons", () => {
    const selected = filterQuestions(MINNA_WORDS, { lessons: [1, 12] });
    expect(selected.length).toBe((WORDS_BY_LESSON.get(1)?.length || 0) + (WORDS_BY_LESSON.get(12)?.length || 0));
    expect(selected.every(word => word.category === "第1課" || word.category === "第12課")).toBe(true);
  });
});
