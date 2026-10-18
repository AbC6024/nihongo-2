import { afterEach, describe, expect, it } from "vitest";
import { clearAllGameData, loadSnapshot, saveSettings, STORAGE_KEYS } from "./storage";
import { DEFAULT_SETTINGS } from "../utils/settings";

afterEach(() => window.localStorage.clear());

describe("shared-site progress isolation", () => {
  it("loads existing listening preferences while preserving the original games", () => {
    const progress = JSON.stringify({levels:{1:3}, records:{speed:100}});
    window.localStorage.setItem('jpq.progress.v1', progress);
    saveSettings({...DEFAULT_SETTINGS, language:'ja', inputMethod:'kana'});
    expect(loadSnapshot().settings.language).toBe('ja');
    expect(loadSnapshot().settings.inputMethod).toBe('kana');
    expect(window.localStorage.getItem('jpq.progress.v1')).toBe(progress);
  });

  it("resets listening data without deleting particle, verb, kana or nickname records", () => {
    window.localStorage.setItem('jpq.progress.v1', '{"levels":{"1":3,"verb-study-v2-1":2},"records":{"kana-read-best":80}}');
    window.localStorage.setItem('jpq.nick.speed', 'Player');
    Object.values(STORAGE_KEYS).forEach(key => window.localStorage.setItem(key, '{}'));
    clearAllGameData();
    expect(window.localStorage.getItem('jpq.progress.v1')).toContain('verb-study-v2-1');
    expect(window.localStorage.getItem('jpq.nick.speed')).toBe('Player');
    Object.values(STORAGE_KEYS).forEach(key => expect(window.localStorage.getItem(key)).toBeNull());
  });
});
