import { describe, expect, it, vi } from "vitest";
import {
  ACCEPTED_IMAGE_TYPES,
  AVATAR_RENDER_SIZE,
  BUILTIN_AVATARS,
  DEFAULT_AVATAR_ID,
  MAX_CUSTOM_AVATAR_CHARS,
  readAndResizeAvatar,
  validateAvatarFile,
} from "./avatars";

// 必須是真正的 File／Blob，jsdom 的 FileReader 才會接受。
const makeFile = (type: string, size: number) =>
  new File([new Uint8Array(size)], "avatar.png", { type });

/** jsdom 沒有 canvas 實作，這裡用可控的 stub 取代。 */
function stubCanvas(dataUrl: string | (() => string), calls: number[] = []) {
  const original = HTMLCanvasElement.prototype.getContext;
  const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement) {
    return {
      drawImage: (_i: unknown, ...rest: number[]) => {
        calls.push(...rest);
      },
    } as unknown as CanvasRenderingContext2D;
  }) as never;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() =>
    typeof dataUrl === "function" ? dataUrl() : dataUrl,
  ) as never;
  return () => {
    HTMLCanvasElement.prototype.getContext = original;
    HTMLCanvasElement.prototype.toDataURL = originalToDataUrl;
  };
}

/** 取代 Image，讓 onload 手動觸發並帶入可控尺寸。 */
function stubImage(width: number, height: number, mode: "load" | "error" = "load") {
  const OriginalImage = globalThis.Image;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = width;
    height = height;
    set src(value: string) {
      void value;
      setTimeout(() => {
        if (mode === "load") this.onload?.();
        else this.onerror?.();
      }, 0);
    }
  }
  (globalThis as { Image: unknown }).Image = FakeImage;
  return () => {
    (globalThis as { Image: unknown }).Image = OriginalImage;
  };
}

describe("validateAvatarFile", () => {
  it("接受的格式全部通過", () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(validateAvatarFile(makeFile(type, 1000))).toEqual({
        ok: true,
        error: null,
        dataUrl: null,
      });
    }
  });

  it("非圖片格式（例如 PDF、SVG）被拒絕", () => {
    expect(validateAvatarFile(makeFile("application/pdf", 1000)).error).toBe("avatarTypeError");
    expect(validateAvatarFile(makeFile("image/svg+xml", 1000)).error).toBe("avatarTypeError");
    expect(validateAvatarFile(makeFile("", 1000)).error).toBe("avatarTypeError");
  });

  it("超過 2 MB 被拒絕", () => {
    expect(validateAvatarFile(makeFile("image/png", 2 * 1024 * 1024)).ok).toBe(true);
    expect(validateAvatarFile(makeFile("image/png", 2 * 1024 * 1024 + 1)).error).toBe(
      "avatarSizeError",
    );
  });
});

describe("readAndResizeAvatar", () => {
  it("檔案驗證失敗時不碰 Canvas，直接回傳錯誤", async () => {
    const restore = stubCanvas("data:image/jpeg;base64,SHOULD_NOT_BE_USED");
    try {
      const result = await readAndResizeAvatar(makeFile("application/pdf", 1000));
      expect(result).toEqual({ ok: false, error: "avatarTypeError", dataUrl: null });
    } finally {
      restore();
    }
  });

  it("正方裁切後縮成 192×192 的 JPEG", async () => {
    const args: number[] = [];
    const restoreCanvas = stubCanvas("data:image/jpeg;base64,AAAA", args);
    const restoreImage = stubImage(800, 400);
    try {
      const result = await readAndResizeAvatar(makeFile("image/png", 5000));
      expect(result.ok).toBe(true);
      expect(result.dataUrl).toBe("data:image/jpeg;base64,AAAA");
      // 來源 800×400 → 取中央 400×400（sx=200, sy=0）→ 縮到 192×192
      expect(args).toEqual([200, 0, 400, 400, 0, 0, AVATAR_RENDER_SIZE, AVATAR_RENDER_SIZE]);
    } finally {
      restoreCanvas();
      restoreImage();
    }
  });

  it("正方形圖片不需要偏移", async () => {
    const args: number[] = [];
    const restoreCanvas = stubCanvas("data:image/jpeg;base64,AAAA", args);
    const restoreImage = stubImage(300, 300);
    try {
      await readAndResizeAvatar(makeFile("image/png", 5000));
      expect(args).toEqual([0, 0, 300, 300, 0, 0, AVATAR_RENDER_SIZE, AVATAR_RENDER_SIZE]);
    } finally {
      restoreCanvas();
      restoreImage();
    }
  });

  it("圖片解碼失敗回傳 avatarDecodeError，不會拋出例外", async () => {
    const restoreCanvas = stubCanvas("data:image/jpeg;base64,AAAA");
    const restoreImage = stubImage(100, 100, "error");
    try {
      await expect(readAndResizeAvatar(makeFile("image/png", 100))).resolves.toEqual({
        ok: false,
        error: "avatarDecodeError",
        dataUrl: null,
      });
    } finally {
      restoreCanvas();
      restoreImage();
    }
  });

  it("Canvas 不可用時回傳 avatarDecodeError", async () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
    const restoreImage = stubImage(100, 100);
    try {
      await expect(readAndResizeAvatar(makeFile("image/png", 100))).resolves.toEqual({
        ok: false,
        error: "avatarDecodeError",
        dataUrl: null,
      });
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
      restoreImage();
    }
  });

  it("toDataURL 拋出例外時不會讓 Promise 炸掉", async () => {
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => {
      throw new Error("tainted canvas");
    }) as never;
    const restoreImage = stubImage(100, 100);
    try {
      await expect(readAndResizeAvatar(makeFile("image/png", 100))).resolves.toEqual({
        ok: false,
        error: "avatarDecodeError",
        dataUrl: null,
      });
    } finally {
      HTMLCanvasElement.prototype.toDataURL = originalToDataUrl;
      restoreImage();
    }
  });

  // 判斷條件是 dataUrl.length > MAX 即拒絕，所以剛好等於上限時必須接受。
  it(`data URL 長度剛好等於上限（${MAX_CUSTOM_AVATAR_CHARS}）則接受`, async () => {
    const restoreCanvas = stubCanvas(() => "A".repeat(MAX_CUSTOM_AVATAR_CHARS));
    const restoreImage = stubImage(100, 100);
    try {
      const result = await readAndResizeAvatar(makeFile("image/png", 100));
      expect(result.ok).toBe(true);
      expect(result.dataUrl).toHaveLength(MAX_CUSTOM_AVATAR_CHARS);
    } finally {
      restoreCanvas();
      restoreImage();
    }
  });

  it("data URL 長度超過上限 1 個字元則拒絕", async () => {
    const restoreCanvas = stubCanvas(() => "A".repeat(MAX_CUSTOM_AVATAR_CHARS + 1));
    const restoreImage = stubImage(100, 100);
    try {
      await expect(readAndResizeAvatar(makeFile("image/png", 100))).resolves.toEqual({
        ok: false,
        error: "avatarSizeError",
        dataUrl: null,
      });
    } finally {
      restoreCanvas();
      restoreImage();
    }
  });
});

describe("內建頭像", () => {
  it("第一個就是預設頭像，找不到時也回退到預設", () => {
    expect(BUILTIN_AVATARS[0].id).toBe(DEFAULT_AVATAR_ID);
    expect(BUILTIN_AVATARS.length).toBeGreaterThanOrEqual(5);
  });
});