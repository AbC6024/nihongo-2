import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppStoreProvider } from "../store/AppStore";
import { ReviewPage } from "../pages/ReviewPage";
import type { EngineApi } from "../hooks/useQuizEngine";
import { MINNA_WORDS } from "../data/minnaBankLoaded";
import { DEFAULT_SETTINGS } from "../utils/settings";
import { STORAGE_KEYS } from "../services/storage";
import type { MistakeEntry } from "../types/game";

let current: EngineApi | null = null;
vi.mock("../components/GameShell", () => ({ GameShell: ({ engine }: { engine: EngineApi }) => { current = engine; return null; } }));
vi.mock("../services/speech", () => ({ playQuestionAudio: vi.fn(async () => "tts"), stopAllAudio: vi.fn() }));
vi.mock("../services/sfx", () => ({ playSfx: vi.fn(), warmUpSfx: vi.fn() }));

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers(); current = null; window.localStorage.clear();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ ...DEFAULT_SETTINGS, sfxEnabled: false }));
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });

async function mount(count: number) {
  const mistakes: Record<string, MistakeEntry> = {};
  for (const word of MINNA_WORDS.slice(0, count)) mistakes[word.id] = {
    questionId: word.id, mode: "word", wrongCount: 1, skipCount: 0, reviewCount: 0,
    starred: false, firstWrongAt: "2026-11-01", lastWrongAt: "2026-11-01"
  };
  window.localStorage.setItem(STORAGE_KEYS.mistakes, JSON.stringify(mistakes));
  await act(async () => root.render(<AppStoreProvider><ReviewPage onExit={() => {}} /></AppStoreProvider>));
  await act(async () => vi.advanceTimersByTimeAsync(2600));
  return new Set(Object.keys(mistakes));
}

describe("updated review rounds", () => {
  for (const size of [3, 13]) it(`finishes once after ${Math.min(size, 10)} distinct mistakes from a ${size}-item notebook`, async () => {
    const allowed = await mount(size);
    const seen = new Set<string>();
    for (let i = 0; i < Math.min(size, 10); i++) {
      const engine = current as unknown as EngineApi;
      const question = engine.question;
      if (!question || !("japanese" in question)) throw new Error("Expected a word mistake");
      expect(allowed.has(question.id)).toBe(true);
      expect(seen.has(question.id)).toBe(false); seen.add(question.id);
      act(() => engine.setInput(question.romaji));
      act(() => current?.submit());
      expect(current?.score).toBe((i + 1) * 100);
      act(() => current?.submit());
      expect(current?.score).toBe((i + 1) * 100);
      act(() => current?.nextQuestion());
    }
    expect(container.querySelector(".result")).not.toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(11000));
    const games = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.games) || "[]");
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ answered: Math.min(size, 10), correct: Math.min(size, 10), gameMode: "review" });
  });

  it("does not start or write a game when the mistake notebook is empty", async () => {
    await mount(0);
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(current).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.games)).toBeNull();
  });
});
