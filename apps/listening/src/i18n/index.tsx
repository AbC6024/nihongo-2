import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { LocaleCode } from "../types/game";
import { zhTW, type TranslationKey, type Translations } from "./locales/zh-TW";
import { ja } from "./locales/ja";
import { en } from "./locales/en";
import { brandDocumentTitle } from "./brand";

export type { TranslationKey, Translations };
export { zhTW, ja, en };
export { BRAND_TITLE, BRAND_TITLE_DECORATED } from "./brand";

export const LOCALES: { code: LocaleCode; label: string }[] = [
  { code: "zh-TW", label: zhTW.langZhTW },
  { code: "ja", label: zhTW.langJa },
  { code: "en", label: zhTW.langEn },
];

export const DEFAULT_LOCALE: LocaleCode = "zh-TW";

export const TRANSLATIONS: Record<LocaleCode, Translations> = {
  "zh-TW": zhTW,
  ja,
  en,
};

export const HTML_LANG: Record<LocaleCode, string> = {
  "zh-TW": "zh-Hant",
  ja: "ja",
  en: "en",
};

export const LOCALE_NAMES: Record<LocaleCode, string> = {
  "zh-TW": zhTW.langZhTW,
  ja: zhTW.langJa,
  en: zhTW.langEn,
};

export const LOCALE_INPUT_METHOD: Record<LocaleCode, { romaji: string; kana: string }> = {
  "zh-TW": { romaji: zhTW.romaji, kana: zhTW.kana },
  ja: { romaji: ja.romaji, kana: ja.kana },
  en: { romaji: en.romaji, kana: en.kana },
};

export const LOCALE_DURATION: Record<LocaleCode, (minutes: number) => string> = {
  "zh-TW": (m) => zhTW.durationMinutes.replace("{n}", String(m)),
  ja: (m) => ja.durationMinutes.replace("{n}", String(m)),
  en: (m) => en.durationMinutes.replace("{n}", String(m)),
};

export function isLocaleCode(value: unknown): value is LocaleCode {
  return value === "zh-TW" || value === "ja" || value === "en";
}

/** 以 {name} 佔位符做簡單插值。 */
export function formatTranslation(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface I18nValue {
  locale: LocaleCode;
  t: TranslateFn;
  setLocale: (locale: LocaleCode) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * 語言 Provider。
 *
 * 語言選擇由外部傳入（由 AppStore 的設定提供，因此會一併存進 localStorage）。
 * 切換語言只會更換介面文字，不會動到錯題本、遊玩紀錄或其他設定。
 */
export function I18nProvider({
  locale,
  onLocaleChange,
  children,
}: {
  locale: LocaleCode;
  onLocaleChange: (locale: LocaleCode) => void;
  children: ReactNode;
}) {
  // 讓瀏覽器知道目前語言（也影響系統字體與輔助功能朗讀的語言）。
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = HTML_LANG[locale];
    // 瀏覽器分頁標題：品牌名稱固定，只有核心文案跟著語言切換。
    document.title = brandDocumentTitle(TRANSLATIONS[locale].tagline);
  }, [locale]);

  const t = useCallback<TranslateFn>(
    (key, params) => formatTranslation(TRANSLATIONS[locale][key], params),
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, t, setLocale: onLocaleChange }),
    [locale, t, onLocaleChange],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * 取翻譯函式。
 * 若元件在 Provider 之外被渲染（例如單獨測試），退回預設語言（繁體中文），
 * 確保畫面仍可正常顯示文字。
 */
export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  const fallback = useMemo<TranslateFn>(
    () => (key, params) => formatTranslation(zhTW[key], params),
    [],
  );
  if (context) return context;
  return { locale: DEFAULT_LOCALE, t: fallback, setLocale: () => {} };
}

export const t = (key: TranslationKey, params?: Record<string, string | number>): string =>
  formatTranslation(zhTW[key], params);