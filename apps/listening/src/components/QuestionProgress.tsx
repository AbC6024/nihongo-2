import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";

interface Props {
  current: number;
  total: number | null;
}

/** 題目進度：一般限時模式以「本局答題數」為進度，今日挑戰以題序為進度。 */
export function QuestionProgress({ current, total }: Props) {
  const percent =
    total && total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total ?? 0}
      aria-valuenow={current}
    >
      <div
        className="progress__bar"
        style={{ width: percent === null ? "100%" : `${percent}%` }}
      />
    </div>
  );
}

interface HudProps {
  remainingMs: number;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  progressLabel: string;
  timed: boolean;
  scoreLabelKey?: TranslationKey;
}

export function Hud({
  remainingMs,
  score,
  correct,
  wrong,
  skipped,
  progressLabel,
  timed,
  scoreLabelKey = "labelScore",
}: HudProps) {
  const { t } = useI18n();
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = timed && seconds <= 10;
  return (
    <div className="hud">
      {timed ? (
        <div className="hud__item hud__item--time" data-urgent={urgent}>
          <span className="hud__label">{t("labelRemaining")}</span>
          <span className="hud__value">{seconds}s</span>
        </div>
      ) : null}
      <div className="hud__item">
        <span className="hud__label">{t(scoreLabelKey)}</span>
        <span className="hud__value">{score}</span>
      </div>
      <div className="hud__item">
        <span className="hud__label">{t("labelCorrect")}</span>
        <span className="hud__value">{correct}</span>
      </div>
      <div className="hud__item">
        <span className="hud__label">{t("labelWrong")}</span>
        <span className="hud__value">{wrong}</span>
      </div>
      <div className="hud__item">
        <span className="hud__label">{t("labelSkipped")}</span>
        <span className="hud__value">{skipped}</span>
      </div>
      <div className="hud__item">
        <span className="hud__label">{t("labelProgress")}</span>
        <span className="hud__value">{progressLabel}</span>
      </div>
    </div>
  );
}