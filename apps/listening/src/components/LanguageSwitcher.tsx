import { useEffect, useRef } from "react";
import { LOCALE_NAMES, LOCALES, useI18n } from "../i18n";
import { useAppStore } from "../store/AppStore";
import type { LocaleCode } from "../types/game";

/**
 * 語言切換下拉選單（介面右上角）。
 *
 * 設計重點：
 * - 使用原生 <select>，桌面滑鼠、手機觸控與鍵盤都可用。
 * - 按鈕文字就是目前選擇的語言名稱（例如「中文 ▼」）。
 * - 切換後立即更新介面，並寫回 localStorage（透過 AppStore 的 settings）。
 * - 小螢幕會自動縮小字級與內距，不會遮住內容或輸入框。
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const { settings, updateSettings } = useAppStore();
  const selectRef = useRef<HTMLSelectElement>(null);

  // 語言變更後讓鍵盤焦點留在選單上，方便連續切換。
  useEffect(() => {
    if (selectRef.current) selectRef.current.value = locale;
  }, [locale]);

  return (
    <div className={`lang-switch${compact ? " lang-switch--compact" : ""}`}>
      <span className="visually-hidden" id="lang-switch-label">
        {t("labelGameLanguage")}
      </span>
      <span className="lang-switch__caret" aria-hidden="true">
        ▾
      </span>
      <select
        ref={selectRef}
        className="lang-switch__select"
        aria-label={t("labelGameLanguage")}
        aria-labelledby="lang-switch-label"
        value={settings.language}
        onChange={(event) =>
          updateSettings({ language: event.target.value as LocaleCode })
        }
      >
        {LOCALES.map((option) => (
          <option key={option.code} value={option.code}>
            {LOCALE_NAMES[option.code]}
          </option>
        ))}
      </select>
    </div>
  );
}