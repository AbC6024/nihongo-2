import { useMemo, useState } from "react";
import { useAppStore } from "../store/AppStore";
import {
  buildAnalytics,
  formatVerdictMessage,
  MODE_LABEL_KEYS,
  verdictLabelKey,
} from "../utils/analytics";
import type { AnalyticsSummary, CategoryStat } from "../types/analytics";
import { toLocalDateKey } from "../utils/date";
import { getTodayBestScore } from "../utils/dailyChallenge";
import { DAILY_MAX_SCORE } from "../utils/scoring";
import { useI18n, type TranslationKey } from "../i18n";

interface Props {
  onOpenMistakes: () => void;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <p className="stat__value">{value}</p>
      <p className="stat__label">{label}</p>
    </div>
  );
}

function StatBar({ stat }: { stat: CategoryStat }) {
  const { t } = useI18n();
  const percent = Math.round(stat.accuracy * 100);
  return (
    <div className="bar-row">
      <span className="bar-row__label">{stat.label}</span>
      <span className="bar-row__value">
        {percent}%
        <span className={`verdict verdict--${stat.verdict}`} style={{ marginLeft: 8 }}>
          {t(verdictLabelKey(stat.verdict))}
        </span>
      </span>
      <span className="bar">
        <span
          className={`bar__fill${stat.verdict === "strong" ? " bar__fill--strong" : ""}${
            stat.verdict === "weak" ? " bar__fill--weak" : ""
          }`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="note">
        {stat.attempts} · {t("statAvgWrong")} {stat.avgWrong} · {t("statTotalSkipped")}{" "}
        {stat.skipped}
      </span>
    </div>
  );
}

export function AnalyticsPage({ onOpenMistakes }: Props) {
  const { attempts, games, mistakes, daily, allWords } = useAppStore();
  const { t } = useI18n();
  const [tab, setTab] = useState<"overview" | "levels" | "history">("overview");

  const byId = useMemo(() => new Map(allWords.map((item) => [item.id, item])), [allWords]);

  const summary: AnalyticsSummary = useMemo(
    () =>
      buildAnalytics({
        attempts,
        games,
        mistakes,
        daily,
        todayKey: toLocalDateKey(),
      }),
    [attempts, games, mistakes, daily],
  );

  const todayBest = getTodayBestScore(daily, toLocalDateKey());

  if (!summary.hasData) {
    return (
      <div className="empty">
        <p className="empty__title">{t("analyticsEmptyTitle")}</p>
        <p>{t("analyticsEmptyDesc")}</p>
      </div>
    );
  }

  const strongLevels = summary.levelStats.filter((stat) => stat.verdict === "strong");
  const weakLevels = summary.levelStats.filter((stat) => stat.verdict === "weak");
  const strongCategories = summary.categoryStats.filter((stat) => stat.verdict === "strong");
  const weakCategories = summary.categoryStats.filter((stat) => stat.verdict === "weak");

  const TABS: { key: typeof tab; label: TranslationKey }[] = [
    { key: "overview", label: "tabCategories" },
    { key: "levels", label: "tabLevels" },
    { key: "history", label: "tabHistory" },
  ];

  return (
    <div>
      <section className="panel">
        <h2 className="panel__title">{t("modeAnalytics")}</h2>
        <div className="stat-grid">
          <Stat value={summary.totalGames} label={t("statTotalGames")} />
          <Stat value={summary.totalAttempts} label={t("statTotalAnswered")} />
          <Stat value={summary.totalCorrect} label={t("statTotalCorrect")} />
          <Stat value={`${Math.round(summary.overallAccuracy * 100)}%`} label={t("statOverallAccuracy")} />
          <Stat
            value={summary.avgResponseTimeMs > 0 ? `${(summary.avgResponseTimeMs / 1000).toFixed(1)}s` : t("dash")}
            label={t("statAvgResponse")}
          />
          <Stat value={summary.avgWrongAttempts} label={t("statAvgWrong")} />
          <Stat value={summary.totalSkipped} label={t("statTotalSkipped")} />
          <Stat value={summary.mistakeCount} label={t("statMistakeCount")} />
          <Stat value={summary.starredCount} label={t("statStarredCount")} />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">{t("dailySection")}</h2>
        <div className="stat-grid">
          <Stat value={summary.dailyStreak.currentStreak} label={t("statCurrentStreak")} />
          <Stat value={summary.dailyStreak.bestStreak} label={t("statBestStreak")} />
          <Stat value={summary.dailyStreak.totalDailyWins} label={t("statDailyWins")} />
          <Stat
            value={todayBest === null ? t("dash") : `${todayBest}/${DAILY_MAX_SCORE}`}
            label={t("statTodayBest")}
          />
        </div>
        <p className="note">
          {t("todayLine", {
            attempts: summary.today.attempts,
            correct: summary.today.correct,
            accuracy: Math.round(summary.today.accuracy * 100),
            status: summary.dailyStreak.todayCompleted
              ? t("todayStatusDone")
              : t("todayStatusPending"),
          })}
        </p>
        <p className="note">
          {summary.dailyStreak.currentStreak > 0
            ? t("streakEncouragement", { n: summary.dailyStreak.currentStreak })
            : t("startStreakEncouragement")}
        </p>
      </section>

      <section className="panel">
        <div className="segmented" style={{ marginBottom: 12 }}>
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="segmented__item"
              aria-pressed={tab === item.key}
              onClick={() => setTab(item.key)}
            >
              {t(item.label)}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <>
            {summary.categoryStats.length === 0 ? (
              <p className="note">{t("noCategoryData")}</p>
            ) : (
              summary.categoryStats.map((stat) => <StatBar key={stat.key} stat={stat} />)
            )}
            <div className="banner banner--info" style={{ marginTop: 12 }}>
              {strongCategories.length > 0 ? (
                <p>{formatVerdictMessage(strongCategories[0].label, { ...strongCategories[0], t })}</p>
              ) : null}
              {weakCategories.length > 0 ? (
                <p>{formatVerdictMessage(weakCategories[0].label, { ...weakCategories[0], t })}</p>
              ) : null}
              {strongCategories.length === 0 && weakCategories.length === 0 ? (
                <p>{t("insufficientNote")}</p>
              ) : null}
            </div>
          </>
        ) : null}

        {tab === "levels" ? (
          <>
            <p className="panel__title">{t("levelSection")}</p>
            {summary.levelStats.map((stat) => (
              <StatBar
                key={stat.difficulty}
                stat={{
                  key: stat.difficulty,
                  label: stat.difficulty,
                  attempts: stat.attempts,
                  correct: Math.round(stat.accuracy * stat.attempts),
                  accuracy: stat.accuracy,
                  avgWrong: stat.avgWrong,
                  skipped: 0,
                  verdict: stat.verdict,
                }}
              />
            ))}
            <p className="panel__title" style={{ marginTop: 16 }}>
              {t("modeSection")}
            </p>
            {summary.modeStats.map((stat) => (
              <StatBar
                key={stat.mode}
                stat={{
                  key: stat.mode,
                  label: t(MODE_LABEL_KEYS[stat.mode] ?? "modeWord"),
                  attempts: stat.attempts,
                  correct: Math.round(stat.accuracy * stat.attempts),
                  accuracy: stat.accuracy,
                  avgWrong: stat.avgWrong,
                  skipped: stat.skipped,
                  verdict: stat.verdict,
                }}
              />
            ))}
            {strongLevels.length > 0 ? (
              <div className="banner banner--info" style={{ marginTop: 12 }}>
                <p>{formatVerdictMessage(strongLevels[0].difficulty, { ...strongLevels[0], t })}</p>
                {weakLevels.length > 0 ? (
                  <p>{formatVerdictMessage(weakLevels[0].difficulty, { ...weakLevels[0], t })}</p>
                ) : null}
              </div>
            ) : null}
            {strongLevels.length === 0 && weakLevels.length === 0 ? (
              <p className="note">{t("insufficientNote")}</p>
            ) : null}
          </>
        ) : null}

        {tab === "history" ? (
          <>
            <p className="panel__title">{t("frequentWrongTitle")}</p>
            {summary.frequentWrong.length === 0 ? (
              <p className="note">{t("frequentWrongEmpty")}</p>
            ) : (
              <ul>
                {summary.frequentWrong.map((item) => {
                  const question = byId.get(item.questionId);
                  return (
                    <li key={item.questionId} className="bar-row">
                      <span className="bar-row__label">
                        {question ? question.japanese : item.questionId}
                      </span>
                      <span className="bar-row__value">{t("wrongTimes", { n: item.wrongCount })}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="panel__title" style={{ marginTop: 16 }}>
              {t("frequentSkippedTitle")}
            </p>
            {summary.frequentSkipped.length === 0 ? (
              <p className="note">{t("frequentSkippedEmpty")}</p>
            ) : (
              <ul>
                {summary.frequentSkipped.map((item) => {
                  const question = byId.get(item.questionId);
                  return (
                    <li key={item.questionId} className="bar-row">
                      <span className="bar-row__label">
                        {question ? question.japanese : item.questionId}
                      </span>
                      <span className="bar-row__value">{t("skipTimes", { n: item.skipCount })}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn--sm" onClick={onOpenMistakes}>
                {t("goMistakes")}
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <h2 className="panel__title">{t("recentGames")}</h2>
        {games.length === 0 ? (
          <p className="note">{t("noGames")}</p>
        ) : (
          <ul>
            {games
              .slice()
              .reverse()
              .slice(0, 10)
              .map((game) => (
                <li key={game.id} className="bar-row">
                  <span className="bar-row__label">
                    {t(MODE_LABEL_KEYS[game.gameMode] ?? "modeWord")} · {game.localDate}
                  </span>
                  <span className="bar-row__value">
                    {game.score} · {game.correct}/{game.answered}（{game.accuracy}%）
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}