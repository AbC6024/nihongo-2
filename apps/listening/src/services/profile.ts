import { DEFAULT_AVATAR_ID, findAvatar, MAX_CUSTOM_AVATAR_CHARS } from "./avatars";

/**
 * 玩家個人檔案（暱稱 + 頭像）。
 *
 * 刻意獨立於 settings 儲存，讓「更換頭像」不會碰到遊戲設定，
 * 也方便獨立備份／還原。
 */

export const PROFILE_SCHEMA_VERSION = 1;

export const DEFAULT_NICKNAME = "玩家";
export const MAX_NICKNAME_LENGTH = 20;

export interface PlayerProfile {
  schemaVersion: number;
  nickname: string;
  /** 內建頭像 ID，或 "custom"。 */
  avatarId: string;
  /** 自訂頭像的 data URL；avatarId 為 "custom" 時有效。 */
  customAvatar: string | null;
  updatedAt: string;
}

export function createDefaultProfile(): PlayerProfile {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    nickname: DEFAULT_NICKNAME,
    avatarId: DEFAULT_AVATAR_ID,
    customAvatar: null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 正規化暱稱：
 * - 去除前後空白
 * - 合併連續空白為半形空格
 * - 去除換行與控制字元（避免破壞版面）
 * - 長度上限 MAX_NICKNAME_LENGTH
 * - 空字串 → 使用預設暱稱（避免介面錯誤）
 *
 * 只作顯示用途：React 會自動跳脫，不會當成程式碼執行。
 */
export function sanitizeNickname(input: unknown): string {
  if (typeof input !== "string") return DEFAULT_NICKNAME;
  const cleaned = input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NICKNAME_LENGTH)
    .trim();
  return cleaned.length > 0 ? cleaned : DEFAULT_NICKNAME;
}

export function isNicknameValid(input: string): boolean {
  return sanitizeNickname(input) === input.trim() && input.trim().length > 0;
}

/** 驗證並填補個人檔案資料，損壞或舊版資料都能安全回復。 */
export function sanitizeProfile(raw: unknown): PlayerProfile {
  const base = createDefaultProfile();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return base;
  const record = raw as Record<string, unknown>;

  const avatarId =
    typeof record.avatarId === "string" && record.avatarId.length <= 64
      ? record.avatarId
      : DEFAULT_AVATAR_ID;

  const customAvatarRaw = record.customAvatar;
  const customAvatar =
    typeof customAvatarRaw === "string" &&
    customAvatarRaw.startsWith("data:image/") &&
    customAvatarRaw.length <= MAX_CUSTOM_AVATAR_CHARS
      ? customAvatarRaw
      : null;

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    nickname: sanitizeNickname(record.nickname),
    // 自訂頭像失效時退回內建，避免顯示破圖
    avatarId: customAvatar === null && avatarId === "custom" ? DEFAULT_AVATAR_ID : avatarId,
    customAvatar,
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
  };
}

export function setNickname(profile: PlayerProfile, nickname: string): PlayerProfile {
  return {
    ...profile,
    nickname: sanitizeNickname(nickname),
    updatedAt: new Date().toISOString(),
  };
}

export function setBuiltinAvatar(profile: PlayerProfile, avatarId: string): PlayerProfile {
  const avatar = findAvatar(avatarId);
  return {
    ...profile,
    avatarId: avatar.id,
    customAvatar: null,
    updatedAt: new Date().toISOString(),
  };
}

export function setCustomAvatar(
  profile: PlayerProfile,
  dataUrl: string | null,
): PlayerProfile {
  if (!dataUrl) return setBuiltinAvatar(profile, DEFAULT_AVATAR_ID);
  return {
    ...profile,
    avatarId: "custom",
    customAvatar: dataUrl,
    updatedAt: new Date().toISOString(),
  };
}

/** 取得頭像要顯示的圖片來源；失效時回退到內建頭像。 */
export function resolveAvatarSrc(profile: PlayerProfile): string | null {
  if (profile.avatarId === "custom" && profile.customAvatar) return profile.customAvatar;
  if (profile.avatarId === "custom") return null;
  return null; // 內建頭像由 React 元件繪製 SVG，不需要圖片網址
}

export function isUsingCustomAvatar(profile: PlayerProfile): boolean {
  return profile.avatarId === "custom" && Boolean(profile.customAvatar);
}