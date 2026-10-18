import { describe, expect, it } from "vitest";
import {
  createDefaultProfile,
  DEFAULT_NICKNAME,
  MAX_NICKNAME_LENGTH,
  sanitizeNickname,
  sanitizeProfile,
  setBuiltinAvatar,
  setCustomAvatar,
  setNickname,
} from "./profile";
import { DEFAULT_AVATAR_ID, MAX_CUSTOM_AVATAR_CHARS, findAvatar, BUILTIN_AVATARS } from "./avatars";

describe("sanitizeNickname", () => {
  it("空字串回到預設暱稱，不會造成介面錯誤", () => {
    expect(sanitizeNickname("")).toBe(DEFAULT_NICKNAME);
    expect(sanitizeNickname("   ")).toBe(DEFAULT_NICKNAME);
    expect(sanitizeNickname(undefined)).toBe(DEFAULT_NICKNAME);
    expect(sanitizeNickname(null)).toBe(DEFAULT_NICKNAME);
    expect(sanitizeNickname(123)).toBe(DEFAULT_NICKNAME);
  });

  it("去除前後空白", () => {
    expect(sanitizeNickname("  小明  ")).toBe("小明");
  });

  it("合併連續空白", () => {
    expect(sanitizeNickname("小明   太郎")).toBe("小明 太郎");
  });

  it("長度上限 20 個字元", () => {
    const long = "あ".repeat(50);
    expect(sanitizeNickname(long)).toHaveLength(MAX_NICKNAME_LENGTH);
  });

  it("移除控制字元與角括號（避免破壞版面）", () => {
    expect(sanitizeNickname("<script>alert(1)</script>")).not.toContain("<");
    // 控制字元被移除（不是轉成空白），避免換行破壞版面
    expect(sanitizeNickname("a\nb\tc")).toBe("abc");
  });

  it("全空白且超長時仍安全", () => {
    expect(sanitizeNickname(" ".repeat(100))).toBe(DEFAULT_NICKNAME);
  });

  it("不修改傳入字串", () => {
    const input = "  小明  ";
    sanitizeNickname(input);
    expect(input).toBe("  小明  ");
  });
});

describe("個人檔案更新", () => {
  it("設定暱稱會去除空白並更新時間", () => {
    const profile = createDefaultProfile();
    const next = setNickname(profile, "  小明  ");
    expect(next.nickname).toBe("小明");
    expect(next.avatarId).toBe(profile.avatarId);
    expect(next.updatedAt).not.toBe("");
  });

  it("選擇內建頭像會清除自訂頭像", () => {
    let profile = createDefaultProfile();
    profile = setCustomAvatar(profile, "data:image/jpeg;base64,AAAA");
    expect(profile.avatarId).toBe("custom");
    profile = setBuiltinAvatar(profile, BUILTIN_AVATARS[3].id);
    expect(profile.avatarId).toBe(BUILTIN_AVATARS[3].id);
    expect(profile.customAvatar).toBeNull();
  });

  it("移除自訂頭像（傳入 null）會回到預設頭像", () => {
    let profile = setCustomAvatar(createDefaultProfile(), "data:image/png;base64,AAAA");
    profile = setCustomAvatar(profile, null);
    expect(profile.avatarId).toBe(DEFAULT_AVATAR_ID);
    expect(profile.customAvatar).toBeNull();
  });
});

describe("sanitizeProfile 資料驗證", () => {
  it("損壞的資料回到預設個人檔案", () => {
    for (const bad of [null, undefined, 123, "x", [], true]) {
      const result = sanitizeProfile(bad);
      expect(result.nickname).toBe(DEFAULT_NICKNAME);
      expect(result.avatarId).toBe(DEFAULT_AVATAR_ID);
    }
  });

  it("保留合法欄位", () => {
    const result = sanitizeProfile({
      nickname: "  小明 ",
      avatarId: "avatar-star",
      customAvatar: null,
    });
    expect(result.nickname).toBe("小明");
    expect(result.avatarId).toBe("avatar-star");
  });

  it("過大的自訂頭像會被丟棄並退回內建", () => {
    const huge = `data:image/png;base64,${"A".repeat(MAX_CUSTOM_AVATAR_CHARS + 10)}`;
    const result = sanitizeProfile({ avatarId: "custom", customAvatar: huge });
    expect(result.customAvatar).toBeNull();
    expect(result.avatarId).not.toBe("custom");
  });

  it("非 data URL 的圖片不被接受（避免載入外部資源）", () => {
    const result = sanitizeProfile({
      avatarId: "custom",
      customAvatar: "https://evil.example/a.png",
    });
    expect(result.customAvatar).toBeNull();
    expect(result.avatarId).not.toBe("custom");
  });

  it("avatarId 為 custom 但沒有圖片時退回內建頭像", () => {
    const result = sanitizeProfile({ avatarId: "custom", customAvatar: null });
    expect(result.avatarId).toBe(DEFAULT_AVATAR_ID);
  });
});

describe("內建頭像", () => {
  it("至少提供 5 種內建頭像加上預設", () => {
    expect(BUILTIN_AVATARS.length).toBeGreaterThanOrEqual(5);
    expect(BUILTIN_AVATARS.some((a) => a.id === DEFAULT_AVATAR_ID)).toBe(true);
  });

  it("頭像 ID 唯一", () => {
    const ids = BUILTIN_AVATARS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("不存在的 ID 會回到預設頭像", () => {
    expect(findAvatar("does-not-exist").id).toBe(DEFAULT_AVATAR_ID);
    expect(findAvatar(null).id).toBe(DEFAULT_AVATAR_ID);
  });
});