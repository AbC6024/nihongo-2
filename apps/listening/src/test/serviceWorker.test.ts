// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const source = readFileSync(resolve(__dirname, "../../pwa/sw.js"), "utf8");
const origin = "https://example.test";
const currentCache = "niiki-board-%2Flistening%2F-current";

interface WorkerRequest {
  url: string;
  method: string;
  mode: string;
}

interface WorkerEvent {
  request?: WorkerRequest;
  waitUntil?: (promise: Promise<unknown>) => void;
  respondWith?: (promise: Promise<Response>) => void;
}

function createWorker(scope = "/listening/") {
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const cache = { add: vi.fn().mockResolvedValue(undefined), match: vi.fn(), put: vi.fn().mockResolvedValue(undefined) };
  const cacheStorage = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn();
  const claim = vi.fn().mockResolvedValue(undefined);
  runInNewContext(source, {
    self: {
      __PRECACHE_MANIFEST__: ["./index.html", "./assets/game.js", "../index.html", "/api/leaderboard"],
      __CACHE_VERSION__: "current",
      registration: { scope: origin + scope },
      location: { origin },
      addEventListener: (name: string, handler: (event: WorkerEvent) => void) => handlers.set(name, handler),
      clients: { claim },
      skipWaiting: vi.fn().mockResolvedValue(undefined),
    },
    caches: cacheStorage,
    fetch,
    URL,
    Request,
    Response,
  });

  const lifecycle = async (name: string) => {
    let work: Promise<unknown> | undefined;
    handlers.get(name)?.({ waitUntil: (promise) => { work = promise; } });
    await work;
  };
  const request = (path: string, mode = "cors", method = "GET") => {
    let result: Promise<Response> | undefined;
    const respondWith = vi.fn((promise: Promise<Response>) => { result = promise; });
    handlers.get("fetch")?.({
      request: { url: new URL(path, origin).href, mode, method },
      respondWith,
    });
    return { respondWith, result };
  };
  return { cache, cacheStorage, fetch, claim, lifecycle, request };
}

function basicResponse(body: string, status = 200): Response {
  const response = new Response(body, { status });
  // Node Response uses "default"; a successful same-origin browser fetch is "basic".
  Object.defineProperty(response, "type", { value: "basic" });
  return response;
}

describe("Service Worker 子路徑隔離", () => {
  it("只預快取註冊路徑內的資源", async () => {
    const worker = createWorker();
    await worker.lifecycle("install");
    expect(worker.cacheStorage.open).toHaveBeenCalledWith(currentCache);
    expect(worker.cache.add.mock.calls.map(([request]) => (request as Request).url)).toEqual([
      origin + "/listening/index.html",
      origin + "/listening/assets/game.js",
    ]);
  });

  it("啟用時只刪除此路徑舊版本，保留主站與其他遊戲", async () => {
    const worker = createWorker();
    worker.cacheStorage.keys.mockResolvedValue([
      currentCache,
      "niiki-board-%2Flistening%2F-old",
      "niiki-board-%2Fother-game%2F-old",
      "niiki-board-legacy",
      "main-site-cache",
    ]);
    await worker.lifecycle("activate");
    expect(worker.cacheStorage.delete.mock.calls).toEqual([["niiki-board-%2Flistening%2F-old"]]);
    expect(worker.claim).toHaveBeenCalledOnce();
  });

  it("不同安裝路徑使用不同快取名稱", async () => {
    const worker = createWorker("/other-game/");
    await worker.lifecycle("install");
    expect(worker.cacheStorage.open).toHaveBeenCalledWith("niiki-board-%2Fother-game%2F-current");
  });

  it("不攔截主站、API、相似路徑、外站或寫入請求", () => {
    const worker = createWorker();
    for (const path of ["/", "/particles.html", "/api/leaderboard", "/listening-other/game.js", "https://cdn.test/audio.mp3"]) {
      expect(worker.request(path).respondWith).not.toHaveBeenCalled();
    }
    expect(worker.request("/listening/data", "cors", "POST").respondWith).not.toHaveBeenCalled();
    expect(worker.cacheStorage.open).not.toHaveBeenCalled();
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it("同範圍資源只查本應用程式快取，命中時不用網路", async () => {
    const worker = createWorker();
    worker.cache.match.mockResolvedValue(basicResponse("cached asset"));
    const response = await worker.request("/listening/assets/game.js").result;
    expect(await response?.text()).toBe("cached asset");
    expect(worker.cacheStorage.open).toHaveBeenCalledWith(currentCache);
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it("導覽優先取得新頁面並更新本路徑快取", async () => {
    const worker = createWorker();
    worker.fetch.mockResolvedValue(basicResponse("fresh page"));
    const response = await worker.request("/listening/", "navigate").result;
    expect(await response?.text()).toBe("fresh page");
    expect(worker.cache.match).not.toHaveBeenCalled();
    expect(worker.cache.put).toHaveBeenCalledOnce();
  });

  it("離線導覽回退到本應用程式的完整 shell URL", async () => {
    const worker = createWorker();
    worker.fetch.mockRejectedValue(new Error("offline"));
    worker.cache.match.mockResolvedValueOnce(undefined).mockResolvedValueOnce(basicResponse("listening shell"));
    const response = await worker.request("/listening/", "navigate").result;
    expect(await response?.text()).toBe("listening shell");
    expect(worker.cache.match).toHaveBeenLastCalledWith(origin + "/listening/index.html", { ignoreSearch: true });
  });

  it("錯誤頁面不會寫入快取", async () => {
    const worker = createWorker();
    worker.fetch.mockResolvedValue(basicResponse("not found", 404));
    const response = await worker.request("/listening/missing.html", "navigate").result;
    expect(response?.status).toBe(404);
    expect(worker.cache.put).not.toHaveBeenCalled();
  });

  it("快取寫入失敗仍回傳取得的網路頁面", async () => {
    const worker = createWorker();
    worker.fetch.mockResolvedValue(basicResponse("fresh page"));
    worker.cache.put.mockRejectedValue(new Error("quota"));
    const response = await worker.request("/listening/", "navigate").result;
    expect(await response?.text()).toBe("fresh page");
  });
});
