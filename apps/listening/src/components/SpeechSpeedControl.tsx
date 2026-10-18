import { useMemo } from "react";
import { useI18n } from "../i18n";
import {
  DEFAULT_SPEECH_RATE_CONFIG,
  SPEECH_SPEED_MULTIPLIERS,
  isSpeechSpeed,
  speechRateConfigFrom,
  speechSpeedLabel,
  type SpeechRateConfig,
  type SpeechSpeedMultiplier,
} from "../utils/speechRate";
import type { GameSettings } from "../types/game";

interface Props {
  settings: GameSettings;
  onChange: (speed: SpeechSpeedMultiplier) => void;
}

/**
 * 遊戲內的語音速度切換。
 *
 * 放在快捷鍵提示下方，只影響「下一次播放的題目語音」：
 * - 切換不會重設計時器、不會清除已輸入的答案、不會改變分數。
 * - 若正在播放，切換只影響下一次播放（不強制中斷，避免誤操作）。
 */
export function SpeechSpeedControl({ settings, onChange }: Props) {
  const { t } = useI18n();
  const current: SpeechSpeedMultiplier = isSpeechSpeed(settings.speechSpeed)
    ? settings.speechSpeed
    : DEFAULT_SPEECH_RATE_CONFIG.speedMultiplier;

  // 顯示目前設定實際會讓題目語音用多少倍速，讓玩家清楚知道結果。
  const activeConfig: SpeechRateConfig = useMemo(
    () => speechRateConfigFrom(settings),
    [settings],
  );

  return (
    <div className="speech-speed" role="group" aria-label={t("speechSpeedLabel")}>
      <span className="speech-speed__title">{t("speechSpeedLabel")}</span>
      <div className="speech-speed__options">
        {SPEECH_SPEED_MULTIPLIERS.map((speed) => {
          const active = current === speed;
          // 短單字（2 音拍）在各設定下的實際倍速，供選項標示。
          const probe = resolveShortWordRate(activeConfig, speed);
          return (
            <button
              key={speed}
              type="button"
              className="speech-speed__btn"
              aria-pressed={active}
              onClick={() => onChange(speed)}
            >
              <span className="speech-speed__name">
                {speed === 1 ? t("speechSpeedNormal") : t("speechSpeedSlow")}
              </span>
              <span className="speech-speed__value">
                {speechSpeedLabel(speed)}
                {probe ? (
                  <span className="speech-speed__hint">{`（${probe}）`}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 計算短單字在此設定下的實際倍速（僅供 UI 顯示）。 */
function resolveShortWordRate(config: SpeechRateConfig, speed: SpeechSpeedMultiplier): string {
  const withSpeed: SpeechRateConfig = { ...config, speedMultiplier: speed };
  const rate = resolveRateForShortWord(withSpeed);
  return rate === null ? "" : `${Math.round(rate * 100) / 100}×`;
}

function resolveRateForShortWord(config: SpeechRateConfig): number | null {
  if (config.speedMultiplier !== 1) return config.speedMultiplier;
  const base = Math.min(2, Math.max(0.5, config.baseRate));
  if (!config.shortWordSlowSpeech) return base;
  return base * config.shortWordRateMultiplier;
}