import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../App";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = "#/home";
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<App />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function click(selector: string) {
  const link = container.querySelector<HTMLAnchorElement>(selector);
  expect(link).not.toBeNull();
  await act(async () => link?.click());
}

describe("merged site navigation", () => {
  it("links to all original games and Hiragana Adventure from the listening subdirectory", () => {
    const links = Array.from(container.querySelectorAll(".learning-site-nav a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "../index.html",
      "../particles.html",
      "../gojuon.html",
      "../conjugation.html",
      "../hiragana/",
      "#/home",
    ]);
    expect(links[links.length - 1]?.getAttribute("aria-current")).toBe("page");
    expect(container.querySelector('.learning-site-nav a[href="../hiragana/"]')?.textContent).toBe("五十音大冒險");
    expect(container.querySelector(".learning-site-brand")?.getAttribute("href")).toBe("../index.html");
  });

  it("opens settings and import while preserving language selection and game back navigation", async () => {
    await click('.listening-tools a[href="#/settings"]');
    expect(window.location.hash).toBe("#/settings");
    expect(container.querySelector('.listening-tools a[aria-current="page"]')?.textContent).toBe("遊戲設定");
    expect(container.querySelector(".lang-switch__select")).not.toBeNull();

    await click('.listening-tools a[href="#/import"]');
    expect(window.location.hash).toBe("#/import");
    expect(container.textContent).toContain("1. 貼上 JSON 或 CSV");

    await act(async () => container.querySelector<HTMLButtonElement>(".topbar__back")?.click());
    expect(window.location.hash).toBe("#/home");
    expect(container.querySelector(".topbar__back")).toBeNull();
    expect(container.querySelector(".topbar__title")?.textContent).toBe("聞いボード");
  });

  it("keeps provenance and local progress information available in each language", async () => {
    expect(container.querySelector(".learning-site-footer a")?.getAttribute("href")).toBe("./DATA_SOURCE.md");
    expect(container.querySelector(".learning-site-footer")?.textContent).toContain("不會自動同步");
    expect(container.querySelector(".learning-site-footer")?.textContent).toContain("機器語音");

    const select = container.querySelector<HTMLSelectElement>(".lang-switch__select");
    await act(async () => {
      if (!select) throw new Error("missing language selector");
      select.value = "en";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector(".learning-site-nav")?.getAttribute("aria-label")).toBe("Site navigation");
    expect(container.querySelector('.learning-site-nav a[href="../hiragana/"]')?.textContent).toBe("Hiragana Adventure");
    expect(container.querySelector(".learning-site-footer")?.textContent).toContain("does not automatically sync");
    expect(container.querySelector(".learning-site-footer a")?.textContent).toBe("Data sources and licenses");

    await act(async () => {
      if (!select) throw new Error("missing language selector");
      select.value = "ja";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector('.learning-site-nav a[href="../hiragana/"]')?.textContent).toBe("ひらがな冒険");
  });
});
