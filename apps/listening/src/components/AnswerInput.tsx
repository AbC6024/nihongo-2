import { useEffect, useRef } from "react";
import type { InputMethod } from "../types/game";
import { useI18n } from "../i18n";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  inputMethod: InputMethod;
  autoFocus?: boolean;
  placeholder?: string;
}

export function AnswerInput({
  value,
  onChange,
  onSubmit,
  disabled,
  inputMethod,
  autoFocus = true,
  placeholder,
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled && autoFocus) {
      ref.current?.focus();
    }
  }, [disabled, autoFocus]);

  // 答錯後把焦點還回輸入框，讓玩家可以立刻重試。
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  return (
    <input
      ref={ref}
      className="answer-input"
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      lang="ja"
      enterKeyHint="send"
      aria-label={t("inputLabel")}
      placeholder={placeholder ?? (inputMethod === "romaji" ? t("inputPlaceholderRomaji") : t("inputPlaceholderKana"))}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        if (event.key === "Enter") {
          event.preventDefault();
          if (!disabled) onSubmit();
        }
      }}
    />
  );
}
