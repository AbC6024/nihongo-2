import { useEffect, useRef, useState } from "react";
import type { SpeechQuality } from "../services/speech";
import { getSpeechAvailability } from "../services/speech";
import { useI18n } from "../i18n";

interface Props {
  onClick: () => unknown | Promise<unknown>;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * 音聲播放按鈕。
 * 若瀏覽器不支援 TTS，按鈕仍存在但會顯示明確提示，不會讓遊戲中斷。
 */
export function AudioButton({ onClick, label, disabled, size = "md" }: Props) {
  const { t } = useI18n();
  const [availability] = useState(getSpeechAvailability);
  const [status, setStatus] = useState<SpeechQuality | null>(null);
  const busyRef = useRef(false);
  const buttonLabel = label ?? t("playAudio");

  useEffect(() => {
    setStatus(null);
  }, [buttonLabel]);

  const className = `btn btn--primary${size === "sm" ? " btn--sm" : ""}${size === "lg" ? " btn--block" : ""}`;

  if (!availability.ttsSupported) {
    return (
      <button type="button" className={className} disabled>
        🔇 {t("ttsUnsupportedButton")}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        try {
          const quality = await onClick();
          setStatus((quality as SpeechQuality) ?? "tts");
        } finally {
          busyRef.current = false;
        }
      }}
      disabled={disabled}
      aria-label={buttonLabel}
      title={status === "audio-file" ? t("playAudio") : t("machineVoiceNote")}
    >
      🔊 {buttonLabel}
      {status === "tts" ? <span className="visually-hidden">（{t("machineVoiceNote")}）</span> : null}
    </button>
  );
}

export function SpeechNotice() {
  const { t } = useI18n();
  const [availability, setAvailability] = useState(getSpeechAvailability());

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
    const handler = () => setAvailability(getSpeechAvailability());
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
  }, []);

  if (!availability.ttsSupported) {
    return <div className="banner banner--warn">{t("ttsUnsupported")}</div>;
  }
  return <p className="note">{t("machineVoiceNote")}</p>;
}