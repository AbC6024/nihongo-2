import { useMemo, useState } from "react";
import { useAppStore } from "../store/AppStore";
import type { GameDuration, InputMethod } from "../types/game";
import type { Difficulty } from "../types/question";
import { DIFFICULTY_ORDER, DURATION_VALUES, INPUT_METHOD_VALUES } from "../utils/settings";
import { availableCategories, availableDifficulties, filterQuestions } from "../utils/randomQuestion";
import { BUILTIN_SENTENCES } from "../data/sentences";
import { isDailyCompleted, getTodayBestScore } from "../utils/dailyChallenge";
import { toLocalDateKey } from "../utils/date";
import { SpeechNotice } from "../components/AudioButton";
import { Avatar } from "../components/Avatar";
import { useI18n, LOCALE_DURATION, LOCALE_INPUT_METHOD, BRAND_TITLE } from "../i18n";

interface Props {
  onStartWord: () => void;
  onStartSentence: () => void;
  onStartReview: () => void;
  onOpenMistakes: () => void;
  onOpenDaily: () => void;
  onOpenAnalytics: () => void;
  onOpenProfile: () => void;
}

export function HomePage({
  onStartWord,
  onStartSentence,
  onStartReview,
  onOpenMistakes,
  onOpenDaily,
  onOpenAnalytics,
  onOpenProfile,
}: Props) {
  const { settings, updateSettings, mistakes, daily, allWords, profile } = useAppStore();
  const { t, locale } = useI18n();
  const [showFilters, setShowFilters] = useState(false);

  // 分類要同時看單字與句子題庫：句子題有「天災」「進階詞彙」等單字題
  // 沒有的分類，只用 allWords 計算會讓玩家無法篩選它們。
  const categories = useMemo(
    () => availableCategories([...allWords, ...BUILTIN_SENTENCES]),
    [allWords],
  );
  const difficulties = useMemo(() => availableDifficulties(allWords), [allWords]);

  const sentencePool = useMemo(
    () =>
      filterQuestions(BUILTIN_SENTENCES, {
        difficulties: settings.difficulties,
        categories: settings.categories,
      }),
    [settings.difficulties, settings.categories],
  );

  const wordPool = useMemo(
    () =>
      filterQuestions(allWords, {
        difficulties: settings.difficulties,
        categories: settings.categories,
      }),
    [allWords, settings.difficulties, settings.categories],
  );

  const todayKey = toLocalDateKey();
  const dailyDone = isDailyCompleted(daily, todayKey);
  const todayBest = getTodayBestScore(daily, todayKey);
  const mistakeCount = Object.keys(mistakes).length;

  const inputLabels = LOCALE_INPUT_METHOD[locale];
  const durationLabel = LOCALE_DURATION[locale];

  const toggleDifficulty = (difficulty: Difficulty) => {
    const next = settings.difficulties.includes(difficulty)
      ? settings.difficulties.filter((item) => item !== difficulty)
      : [...settings.difficulties, difficulty];
    updateSettings({ difficulties: next.length > 0 ? next : [difficulty] });
  };

  const toggleCategory = (category: string) => {
    const next = settings.categories.includes(category)
      ? settings.categories.filter((item) => item !== category)
      : [...settings.categories, category];
    updateSettings({ categories: next });
  };

  return (
    <div>
      {/* 個人檔案入口：固定在主畫面左上角 */}
      <button type="button" className="profile-entry" onClick={onOpenProfile}>
        <Avatar profile={profile} size={44} />
        <span className="profile-entry__text">
          <span className="profile-entry__name">{profile.nickname}</span>
          <span className="profile-entry__hint">{t("profileEntryHint")}</span>
        </span>
        <span className="profile-entry__caret" aria-hidden="true">
          ›
        </span>
      </button>

      <header className="hero">
        <p className="hero__title">{BRAND_TITLE}</p>
        <p className="hero__sub">{t("tagline")}</p>
        <div className="hero__streak">
          <span className="chip">
            {t("streakToday", {
              n: daily.currentStreak > 0 ? daily.currentStreak : t("streakNotStarted"),
            })}
          </span>
          <span className="chip">{t("streakBest", { n: daily.bestStreak })}</span>
          <span className="chip">{t("streakTotalWins", { n: daily.totalDailyWins })}</span>
          {dailyDone && todayBest !== null ? (
            <span className="chip chip--good">
              {t("todayDoneBest", { score: todayBest })}
            </span>
          ) : null}
        </div>
      </header>

      <div className="mode-grid">
        <button type="button" className="mode-card" onClick={onStartWord}>
          <span className="mode-card__title">{t("modeWord")}</span>
          <span className="mode-card__desc">{t("modeWordDesc")}</span>
        </button>
        <button
          type="button"
          className="mode-card"
          onClick={onStartSentence}
          disabled={sentencePool.length === 0}
        >
          <span className="mode-card__title">{t("modeSentence")}</span>
          <span className="mode-card__desc">{t("modeSentenceDesc", { n: sentencePool.length })}</span>
        </button>
        <button
          type="button"
          className="mode-card"
          onClick={onStartReview}
          disabled={mistakeCount === 0}
        >
          <span className="mode-card__title">{t("modeReview")}</span>
          <span className="mode-card__desc">{t("modeReviewDesc", { n: mistakeCount })}</span>
        </button>
        <button type="button" className="mode-card" onClick={onOpenMistakes}>
          <span className="mode-card__title">{t("modeMistakes")}</span>
          <span className="mode-card__desc">{t("modeMistakesDesc", { n: mistakeCount })}</span>
        </button>
        <button type="button" className="mode-card" onClick={onOpenDaily}>
          <span className="mode-card__title">{t("modeDaily")}</span>
          <span className="mode-card__desc">
            {t("modeDailyDesc")}
            {dailyDone ? ` ${t("modeDailyDescDone")}` : ""}
          </span>
        </button>
        <button type="button" className="mode-card" onClick={onOpenAnalytics}>
          <span className="mode-card__title">{t("modeAnalytics")}</span>
          <span className="mode-card__desc">{t("modeAnalyticsDesc")}</span>
        </button>
      </div>

      <section className="panel">
        <h2 className="panel__title">{t("practiceSettings")}</h2>

        <div className="field">
          <span className="field__label">{t("labelDuration")}</span>
          <div className="segmented" role="group" aria-label={t("labelDuration")}>
            {DURATION_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                className="segmented__item"
                aria-pressed={settings.duration === value}
                onClick={() => updateSettings({ duration: value as GameDuration })}
              >
                {durationLabel(value / 60)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">{t("labelInputMethod")}</span>
          <div className="segmented" role="group" aria-label={t("labelInputMethod")}>
            {INPUT_METHOD_VALUES.map((method: InputMethod) => (
              <button
                key={method}
                type="button"
                className="segmented__item"
                aria-pressed={settings.inputMethod === method}
                onClick={() => updateSettings({ inputMethod: method })}
              >
                {inputLabels[method]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">
            {t("labelFilters", { words: wordPool.length, sentences: sentencePool.length })}
          </span>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setShowFilters((prev) => !prev)}
            aria-expanded={showFilters}
          >
            {showFilters ? t("collapseFilters") : t("expandFilters")}
          </button>
          {showFilters ? (
            <div style={{ marginTop: 10 }}>
              <div className="chip-set">
                {DIFFICULTY_ORDER.map((difficulty) => {
                  const available = difficulties.includes(difficulty);
                  const active = settings.difficulties.includes(difficulty);
                  return (
                    <button
                      key={difficulty}
                      type="button"
                      className="segmented__item"
                      style={{
                        flex: "0 0 auto",
                        background: active ? "var(--accent)" : "var(--surface-alt)",
                        color: active ? "#fff" : "var(--ink-soft)",
                        borderColor: active ? "var(--accent)" : "var(--line)",
                        opacity: available ? 1 : 0.5,
                      }}
                      aria-pressed={active}
                      aria-label={t("labelDifficulty")}
                      onClick={() => toggleDifficulty(difficulty)}
                    >
                      {available ? difficulty : t("difficultyNoItems", { level: difficulty })}
                    </button>
                  );
                })}
              </div>
              <div className="chip-set" style={{ marginTop: 8 }}>
                {categories.map((category) => {
                  const active = settings.categories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      className="chip"
                      style={{
                        background: active ? "var(--accent)" : "var(--surface)",
                        color: active ? "#fff" : "var(--ink-soft)",
                        borderColor: active ? "var(--accent)" : "var(--line)",
                      }}
                      aria-pressed={active}
                      aria-label={t("labelCategory")}
                      onClick={() => toggleCategory(category)}
                    >
                      {category}
                    </button>
                  );
                })}
                {settings.categories.length > 0 ? (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => updateSettings({ categories: [] })}
                  >
                    {t("clearCategoryFilter")}
                  </button>
                ) : null}
              </div>
              {wordPool.length === 0 || sentencePool.length === 0 ? (
                <p className="note" style={{ marginTop: 8 }}>
                  {t("noQuestionsInFilter")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onStartWord}
            disabled={wordPool.length === 0}
            style={{ flex: 1 }}
          >
            {t("startWordMode")}
          </button>
        </div>
        {wordPool.length === 0 ? (
          <p className="note" style={{ marginTop: 8 }}>
            {t("noWordsInFilter")}
          </p>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <SpeechNotice />
        </div>
      </section>
    </div>
  );
}