import { useMemo, useState } from "react";
import { useAppStore } from "../store/AppStore";
import { StarButton } from "../components/StarButton";
import { AudioButton } from "../components/AudioButton";
import { playText } from "../services/speech";
import { speechRateConfigFrom } from "../utils/speechRate";
import type { MistakeEntry } from "../types/game";
import type { Question } from "../types/question";
import { isSentenceQuestion } from "../types/question";
import { useI18n, type TranslationKey } from "../i18n";

interface Props {
  onStartReview: () => void;
  onBack: () => void;
}

type SortKey = "recent" | "wrong" | "starred";

const SORT_LABELS: Record<SortKey, TranslationKey> = {
  recent: "sortRecent",
  wrong: "sortWrong",
  starred: "sortStarred",
};

export function MistakesPage({ onStartReview, onBack }: Props) {
  const { mistakes, allWords, settings, toggleStar, removeMistake, clearMistakes } = useAppStore();
  const { t } = useI18n();
  const [sort, setSort] = useState<SortKey>("recent");
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const speechRateConfig = useMemo(() => speechRateConfigFrom(settings), [settings]);

  const byId = useMemo(() => new Map(allWords.map((item) => [item.id, item])), [allWords]);

  const rows = useMemo(() => {
    const entries = Object.values(mistakes);
    const sorted = entries.slice().sort((a, b) => {
      if (sort === "starred") {
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
        return b.wrongCount - a.wrongCount;
      }
      if (sort === "wrong") return b.wrongCount - a.wrongCount || b.skipCount - a.skipCount;
      return b.lastWrongAt.localeCompare(a.lastWrongAt);
    });
    const result: { entry: MistakeEntry; question: Question }[] = [];
    for (const entry of sorted) {
      const question = byId.get(entry.questionId);
      if (question) result.push({ entry, question });
    }
    return result;
  }, [mistakes, byId, sort]);

  const orphaned = Object.keys(mistakes).filter((id) => !byId.has(id));
  const totalCount = Object.keys(mistakes).length;

  const speak = (question: Question) =>
    playText(isSentenceQuestion(question) ? question.sentence : question.japanese, {
      speechRateConfig,
    });

  if (totalCount === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{t("emptyMistakesTitle")}</p>
        <p>{t("emptyMistakesDesc")}</p>
        <div className="btn-row" style={{ justifyContent: "center", marginTop: 12 }}>
          <button type="button" className="btn btn--primary" onClick={onBack}>
            {t("goPlay")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="panel">
        <h2 className="panel__title">{t("mistakesTitle", { n: totalCount })}</h2>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onStartReview}
            disabled={rows.length === 0}
          >
            {t("startReview")}
          </button>
          {confirmClear ? (
            <>
              <button
                type="button"
                className="btn btn--sm btn--danger"
                onClick={() => {
                  clearMistakes();
                  setConfirmClear(false);
                }}
              >
                {t("confirmClearAll", { n: totalCount })}
              </button>
              <button type="button" className="btn btn--sm" onClick={() => setConfirmClear(false)}>
                {t("cancel")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={() => setConfirmClear(true)}
              disabled={rows.length === 0}
            >
              {t("clearAllMistakes")}
            </button>
          )}
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          {t("clearNote")}
        </p>
      </section>

      <section className="panel">
        <div className="field" style={{ marginBottom: 8 }}>
          <span className="field__label">{t("sortLabel")}</span>
          <div className="segmented">
            {(["recent", "wrong", "starred"] as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className="segmented__item"
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
              >
                {t(SORT_LABELS[key])}
              </button>
            ))}
          </div>
        </div>
      </section>

      {orphaned.length > 0 ? (
        <div className="banner banner--warn">{t("orphanedWarning", { n: orphaned.length })}</div>
      ) : null}

      {rows.map(({ entry, question }) => {
        const sentence = isSentenceQuestion(question);
        const target = sentence ? question.answer : question.japanese;
        const kana = question.kana;
        const romaji = question.romaji;
        const meaning = question.meaning;
        return (
          <article
            key={entry.questionId}
            className={`mistake-card${entry.starred ? " mistake-card--starred" : ""}`}
          >
            <div className="mistake-card__top">
              <div>
                <p className="mistake-card__word">{target}</p>
                <p className="mistake-card__sub">
                  {kana ? <span>{kana}　</span> : null}
                  {romaji ? <span>{romaji}</span> : null}
                </p>
                {meaning ? <p className="mistake-card__sub">{meaning}</p> : null}
                {sentence ? (
                  <p className="mistake-card__sub">
                    {t("sentenceLabel", { text: question.sentence })}
                  </p>
                ) : null}
                <p className="note">
                  {t("mistakeStats", {
                    level: question.difficulty,
                    category: question.category,
                    wrong: entry.wrongCount,
                  })}
                  {entry.skipCount > 0
                    ? t("mistakeStatsSkip", { n: entry.skipCount })
                    : ""}
                  {entry.reviewCount > 0
                    ? t("mistakeStatsReview", { n: entry.reviewCount })
                    : ""}
                </p>
                {entry.starred ? (
                  <span className="verdict verdict--strong">{t("starredBadge")}</span>
                ) : null}
              </div>
              <StarButton starred={entry.starred} onToggle={() => toggleStar(entry.questionId)} />
            </div>

            <div className="mistake-card__actions">
              <AudioButton
                size="sm"
                onClick={() => speak(question)}
                label={settings.useAudioFiles ? t("playAudio") : t("playPronunciationTts")}
              />
              {confirmDelete === entry.questionId ? (
                <>
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => {
                      removeMistake(entry.questionId);
                      setConfirmDelete(null);
                    }}
                  >
                    {t("confirmDelete")}
                  </button>
                  <button type="button" className="btn btn--sm" onClick={() => setConfirmDelete(null)}>
                    {t("cancel")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  onClick={() => setConfirmDelete(entry.questionId)}
                >
                  {t("deleteItem")}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}