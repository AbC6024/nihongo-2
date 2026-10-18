import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AnswerInput } from "./AnswerInput";
import { I18nProvider } from "../i18n";

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

describe("Japanese typing submission", () => {
  it("uses Enter to submit only after IME composition is finished", () => {
    const submit = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(
      <I18nProvider locale="zh-TW" onLocaleChange={() => {}}>
        <AnswerInput value="ねこ" onChange={() => {}} onSubmit={submit} disabled={false} inputMethod="kana" />
      </I18nProvider>,
    ));
    const input = container.querySelector("input")!;
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", isComposing:true, bubbles:true})));
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", keyCode:229, bubbles:true})));
    expect(submit).not.toHaveBeenCalled();
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true})));
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
