import type { EngineResult } from "../hooks/useQuizEngine";
import { calculateAccuracy, DAILY_MAX_SCORE } from "../utils/scoring";
import { useI18n, type TranslationKey } from "../i18n";

interface Props {
  mode: "word" | "sentence" | "daily" | "review";
  result: EngineResult;
  startedAt: string;
  dailyStreak?: { current: number; best: number; isNewWin: boolean };
  onRetry: () => void;
  onHome: () => void;
  onReview?: () => void;
}

const TITLE_KEYS: Record<Props["mode"], TranslationKey> = {
  word: "resultTimeUp",
  sentence: "resultFinished",
  daily: "resultDailyDone",
  review: "resultReviewDone",
};

export function ResultView({
  mode,
  result,
  startedAt,
  dailyStreak,
  onRetry,
  onHome,
  onReview,
}: Props) {
  const { t } = useI18n();
  const accuracy = calculateAccuracy({ correct: result.correct, answered: result.answered });
  const durationSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(startedAt).getTime()) / 1000),
  );

  return (
    <div className="card result">
      <p className="card__eyebrow">{t(TITLE_KEYS[mode])}</p>
      <p className="result__score">{result.score}</p>
      <p className="result__label">
        {mode === "daily" ? t("maxSuffix", { max: DAILY_MAX_SCORE }) : t("pointsSuffix")}
      </p>

      <div className="stat-grid">
        <div className="stat">
          <p className="stat__value">{result.answered}</p>
          <p className="stat__label">{t("statAnswered")}</p>
        </div>
        <div className="stat">
          <p className="stat__value">{result.correct}</p>
          <p className="stat__label">{t("statCorrect")}</p>
        </div>
        <div className="stat">
          <p className="stat__value">{result.wrong}</p>
          <p className="stat__label">{t("statWrong")}</p>
        </div>
        <div className="stat">
          <p className="stat__value">{result.skipped}</p>
          <p className="stat__label">{t("statSkipped")}</p>
        </div>
        <div className="stat">
          <p className="stat__value">{accuracy}%</p>
          <p className="stat__label">{t("statAccuracy")}</p>
        </div>
        <div className="stat">
          <p className="stat__value">{durationSeconds}s</p>
          <p className="stat__label">{t("statPlayTime")}</p>
        </div>
      </div>

      {mode === "daily" && dailyStreak ? (
        <div className="banner banner--info">
          {t("streakLine", { current: dailyStreak.current, best: dailyStreak.best })}{" "}
          {dailyStreak.isNewWin ? t("streakLineNewWin") : t("streakLineAlready")}
        </div>
      ) : null}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          {t("playAgain")}
        </button>
        {onReview && result.wrong > 0 ? (
          <button type="button" className="btn" onClick={onReview}>
            {t("reviewMistakesNow")}
          </button>
        ) : null}
        <button type="button" className="btn" onClick={onHome}>
          {t("goHome")}
        </button>
      </div>
    </div>
  );
}