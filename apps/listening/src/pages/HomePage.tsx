import { useMemo, useState } from "react";
import { useAppStore } from "../store/AppStore";
import type { GameDuration, InputMethod } from "../types/game";
import { DURATION_VALUES, INPUT_METHOD_VALUES } from "../utils/settings";
import { filterQuestions } from "../utils/randomQuestion";
import {
  MINNA_LESSONS,
  MINNA_WORDS,
  LESSON_COUNTS,
} from "../data/minnaBankLoaded";
import { SpeechNotice } from "../components/AudioButton";
import { Avatar } from "../components/Avatar";
import { useI18n, LOCALE_INPUT_METHOD, LOCALE_DURATION, BRAND_TITLE } from "../i18n";

interface Props {
  onStartWord: () => void;
  onStartReview: () => void;
  onOpenMistakes: () => void;
  onOpenProfile: () => void;
}

export function HomePage({
  onStartWord,
  onStartReview,
  onOpenMistakes,
  onOpenProfile,
}: Props) {
  const { settings, updateSettings, mistakes, profile } = useAppStore();
  const { t, locale } = useI18n();
  const [showFilters, setShowFilters] = useState(false);

  // 課次篩選：依 settings.lessons 篩選題庫
  const wordPool = useMemo(
    () =>
      filterQuestions(MINNA_WORDS, {
        lessons: settings.lessons.length > 0 ? settings.lessons : [],
      }),
    [settings.lessons],
  );

  const mistakeCount = Object.keys(mistakes).length;

  const inputLabels = LOCALE_INPUT_METHOD[locale];
  const durationLabel = LOCALE_DURATION[locale];

  const toggleLesson = (lessonNumber: number) => {
    const next = settings.lessons.includes(lessonNumber)
      ? settings.lessons.filter((item) => item !== lessonNumber)
      : [...settings.lessons, lessonNumber];
    updateSettings({ lessons: next });
  };

  const selectAllLessons = () => {
    updateSettings({ lessons: MINNA_LESSONS.map((l) => l.number) });
  };

  const clearAllLessons = () => {
    updateSettings({ lessons: [] });
  };

  const hasAnyLesson = settings.lessons.length > 0;
  const selectedLessonCount = settings.lessons.length;
  const totalLessonCount = MINNA_LESSONS.length;

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
      </header>

      <div className="mode-grid">
        <button
          type="button"
          className="mode-card"
          onClick={onStartWord}
          disabled={!hasAnyLesson || wordPool.length === 0}
        >
          <span className="mode-card__title">{t("modeWord")}</span>
          <span className="mode-card__desc">{t("modeWordDesc")}</span>
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
            選擇課程（{wordPool.length} 題）
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
            <div style={{ marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
              {/* 全選／取消全選 */}
              <div className="chip-set" style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="chip"
                  onClick={selectAllLessons}
                  disabled={selectedLessonCount === totalLessonCount}
                >
                  全選
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={clearAllLessons}
                  disabled={selectedLessonCount === 0}
                >
                  取消全選
                </button>
              </div>

              {/* 課程選擇 */}
              <div className="chip-set">
                {MINNA_LESSONS.map((lesson) => {
                  const active = settings.lessons.includes(lesson.number);
                  const count = LESSON_COUNTS[lesson.number] ?? 0;
                  return (
                    <button
                      key={lesson.number}
                      type="button"
                      className="chip"
                      style={{
                        background: active ? "var(--accent)" : "var(--surface)",
                        color: active ? "#fff" : "var(--ink-soft)",
                        borderColor: active ? "var(--accent)" : "var(--line)",
                      }}
                      aria-pressed={active}
                      aria-label={`${lesson.name}（${count} 題）`}
                      onClick={() => toggleLesson(lesson.number)}
                    >
                      {lesson.name}
                    </button>
                  );
                })}
              </div>

              {!hasAnyLesson ? (
                <p className="note" style={{ marginTop: 8 }}>
                  請至少選擇一個課程才能開始練習
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
            disabled={!hasAnyLesson || wordPool.length === 0}
            style={{ flex: 1 }}
          >
            {t("startWordMode")}
          </button>
        </div>
        {!hasAnyLesson || wordPool.length === 0 ? (
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