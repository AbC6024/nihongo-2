/**
 * 內建頭像。
 *
 * 全部由程式產生（內嵌 SVG 字串），沒有外部檔案與授權問題。
 * 自訂上傳的圖片以 data URL 儲存在 localStorage，並限制大小。
 */

export interface AvatarOption {
  id: string;
  /** 無障礙標籤（由 i18n 翻譯，見 avatarLabelKey）。 */
  labelKey: string;
  /** 背景色 */
  bg: string;
  /** 前景色 */
  fg: string;
  /** 圖示路徑資料 */
  path: string;
}

export const DEFAULT_AVATAR_ID = "avatar-default";

export const BUILTIN_AVATARS: AvatarOption[] = [
  {
    id: DEFAULT_AVATAR_ID,
    labelKey: "avatarDefault",
    bg: "#c2410c",
    fg: "#ffffff",
    path: "M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z",
  },
  {
    id: "avatar-wave",
    labelKey: "avatarWave",
    bg: "#0f766e",
    fg: "#ffffff",
    path: "M3 12h2l2-6 3 13 3-17 3 13 2-6h3",
  },
  {
    id: "avatar-book",
    labelKey: "avatarBook",
    bg: "#1d4ed8",
    fg: "#ffffff",
    path: "M4 4h7v16H4zM13 4h7v16h-7z",
  },
  {
    id: "avatar-cat",
    labelKey: "avatarCat",
    bg: "#7c3aed",
    fg: "#ffffff",
    path: "M5 6l3 2h8l3-2v11a2 2 0 01-2 2H7a2 2 0 01-2-2zm4 6a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z",
  },
  {
    id: "avatar-star",
    labelKey: "avatarStar",
    bg: "#b45309",
    fg: "#ffffff",
    path: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  },
  {
    id: "avatar-spark",
    labelKey: "avatarSpark",
    bg: "#be123c",
    fg: "#ffffff",
    path: "M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z",
  },
  {
    id: "avatar-leaf",
    labelKey: "avatarLeaf",
    bg: "#15803d",
    fg: "#ffffff",
    path: "M20 4c0 9-5 14-11 14-2 0-4-1-5-2 1-6 6-10 16-12zm-16 16h2v4H4z",
  },
  {
    id: "avatar-dot",
    labelKey: "avatarDot",
    bg: "#334155",
    fg: "#ffffff",
    path: "M12 4a8 8 0 110 16 8 8 0 010-16zm0 4a4 4 0 100 8 4 4 0 000-8z",
  },
];

export function findAvatar(id: string | null | undefined): AvatarOption {
  return BUILTIN_AVATARS.find((avatar) => avatar.id === id) ?? BUILTIN_AVATARS[0];
}

/** 自訂上傳圖片的大小上限（data URL 字串長度）。 */
export const MAX_CUSTOM_AVATAR_CHARS = 160_000;

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** 自訂頭像上傳後的邊長（像素）。 */
export const AVATAR_RENDER_SIZE = 192;

export interface AvatarValidationResult {
  ok: boolean;
  error: string | null;
  dataUrl: string | null;
}

/**
 * 驗證使用者上傳的圖片。
 * 檔案大小上限 2 MB；驗證通過後縮圖到 AVATAR_RENDER_SIZE 再轉成 data URL，
 * 避免塞爆 localStorage。
 */
export function validateAvatarFile(file: File): AvatarValidationResult {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: "avatarTypeError", dataUrl: null };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "avatarSizeError", dataUrl: null };
  }
  return { ok: true, error: null, dataUrl: null };
}

/** 讀取並縮圖；任何失敗都回傳錯誤代碼，不會拋出例外。 */
export function readAndResizeAvatar(file: File): Promise<AvatarValidationResult> {
  const base = validateAvatarFile(file);
  if (!base.ok) return Promise.resolve(base);

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, error: "avatarReadError", dataUrl: null });
    reader.onload = () => {
      const source = String(reader.result ?? "");
      const image = new Image();
      image.onerror = () => resolve({ ok: false, error: "avatarDecodeError", dataUrl: null });
      image.onload = () => {
        try {
          const size = AVATAR_RENDER_SIZE;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext("2d");
          if (!context) {
            resolve({ ok: false, error: "avatarDecodeError", dataUrl: null });
            return;
          }
          // 正方裁切 + 縮放
          const minSide = Math.min(image.width, image.height);
          context.drawImage(
            image,
            (image.width - minSide) / 2,
            (image.height - minSide) / 2,
            minSide,
            minSide,
            0,
            0,
            size,
            size,
          );
          // 轉 JPEG 壓縮，確保不會超過 localStorage 容量
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          if (dataUrl.length > MAX_CUSTOM_AVATAR_CHARS) {
            resolve({ ok: false, error: "avatarSizeError", dataUrl: null });
            return;
          }
          resolve({ ok: true, error: null, dataUrl });
        } catch {
          resolve({ ok: false, error: "avatarDecodeError", dataUrl: null });
        }
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

export const AVATAR_ERROR_MESSAGES: Record<string, { zhTW: string; ja: string; en: string }> = {
  avatarTypeError: {
    zhTW: "只接受 PNG／JPEG／WebP／GIF 圖片。",
    ja: "PNG／JPEG／WebP／GIF の画像のみ受け付けます。",
    en: "Only PNG, JPEG, WebP, or GIF images are accepted.",
  },
  avatarSizeError: {
    zhTW: "圖片太大（上限 2 MB），請換一張較小的圖片。",
    ja: "画像が大きすぎます（上限 2 MB）。もう少し小さい画像を選んでください。",
    en: "The image is too large (max 2 MB). Please choose a smaller one.",
  },
  avatarReadError: {
    zhTW: "無法讀取圖片，請重新選擇。",
    ja: "画像を読み込めませんでした。もう一度選んでください。",
    en: "Could not read the image. Please try again.",
  },
  avatarDecodeError: {
    zhTW: "圖片格式無法處理，請換一張圖片。",
    ja: "この画像は処理できません。別の画像を選んでください。",
    en: "This image could not be processed. Please choose another one.",
  },
};