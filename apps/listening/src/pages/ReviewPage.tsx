import { useCallback, useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/AppStore";
import { useQuizEngine, type EngineResult } from "../hooks/useQuizEngine";
import { GameShell } from "../components/GameShell";
import { ResultView } from "../components/ResultView";
import { playQuestionAudio } from "../services/speech";
import { playSfx } from "../services/sfx";
import { calculateAccuracy } from "../utils/scoring";
import { speechRateConfigFrom } from "../utils/speechRate";
import { useI18n } from "../i18n";
import { toLocalDateKey } from "../utils/date";
import type { GameRecord } from "../types/game";
import type { Question } from "../types/question";
import { isSentenceQuestion } from "../types/question";
import {
  buildReviewPool,
  buildWeightedReviewSequence,
  shuffleQuestions,
} from "../utils/randomQuestion";

interface Props {
  onExit: () => void;
  /** 從結果頁「立刻複習錯題」進入時，預設只看錯題。 */
  mistakesOnly?: boolean;
}

export function ReviewPage({ onExit, mistakesOnly = false }: Props) {
  const { allWords, settings, mistakes, recordAttempt, recordGame, markReviewed, registerWrong, updateSettings } =
    useAppStore();
  const { t } = useI18n();
  const [session, setSession] = useState(0);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  // 一局遊戲只會寫入一筆歷史紀錄。
  const recordedRef = useRef(false);

  /**
   * 複習題目順序：依 50%（星號）／30%（其他錯題）／20%（一般題目）加權抽題，
   * 每輪把可用題目抽完為止，確保錯題一定會出現。
   */
  /**
   * 這一局的題目順序：每次「開始新局」重新隨機抽取。
   * 複習模式仍用 50%（星號）／30%（其他錯題）／20%（一般題目）的權重，
   * 缺漏的比例會自動分配給還有題目的類別。
   */
  const pool = useMemo(() => {
    const reviewPool = buildReviewPool(allWords, Object.values(mistakes), (item) => item.id);
    if (mistakesOnly) {
      // 僅複習錯題時：錯題本身已是優先來源，只做隨機洗牌。
      return shuffleQuestions([...reviewPool.starred, ...reviewPool.otherMistakes]);
    }
    return buildWeightedReviewSequence(reviewPool, (item) => item.id);
    // sessionIndex 改變代表開始新局 → 重新隨機
  }, [allWords, mistakes, mistakesOnly, sessionIndex]);

  const speak = useCallback(
    (question: Question) =>
      playQuestionAudio(question, {
        useAudioFiles: settings.useAudioFiles,
        speechRateConfig: speechRateConfigFrom(settings),
      }),
    [settings],
  );

  const engine = useQuizEngine(
    {
      mode: "review",
      settings,
      questions: pool,
      ordered: false,
      timeLimitSeconds: 0,
      // 複習模式跳過不扣一般模式的 -50 分，只記錄 skipped，避免懲罰式複習。
      skipPenalty: false,
      autoSpeak: true,
    },
    {
      onAttemptSettled: (attempt) => {
        recordAttempt(attempt);
        markReviewed(attempt.questionId);
      },
      onWrongRegistered: (questionId, gameMode, skipped) =>
        registerWrong(questionId, gameMode, skipped),
      onSfx: (name) => playSfx(name, { enabled: settings.sfxEnabled, volume: settings.sfxVolume }),
      onGameFinished: (finished) => {
        setResult(finished);
        if (recordedRef.current) return;
        recordedRef.current = true;
        const record: GameRecord = {
          id: `review-${startedAt}-${session}-${sessionIndex}`,
          startedAt,
          endedAt: new Date().toISOString(),
          localDate: toLocalDateKey(),
          gameMode: "review",
          durationSeconds: 0,
          score: finished.score,
          answered: finished.answered,
          correct: finished.correct,
          wrong: finished.wrong,
          skipped: finished.skipped,
          accuracy: calculateAccuracy({ correct: finished.correct, answered: finished.answered }),
        };
        recordGame(record);
      },
    },
    speak,
  );

  const mistakeCount = Object.keys(mistakes).length;

  if (mistakeCount === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{t("emptyReviewTitle")}</p>
        <p>{t("emptyReviewDesc")}</p>
        <div className="btn-row" style={{ justifyContent: "center", marginTop: 12 }}>
          <button type="button" className="btn btn--primary" onClick={onExit}>
            {t("startPractice")}
          </button>
        </div>
      </div>
    );
  }

  if (pool.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{t("noReviewableTitle")}</p>
        <p>{t("noReviewableDesc")}</p>
        <button type="button" className="btn" onClick={onExit}>
          {t("goHome")}
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <ResultView
        mode="review"
        result={result}
        startedAt={startedAt}
        onRetry={() => {
          setResult(null);
          setStartedAt(new Date().toISOString());
          setSession((value) => value + 1);
          setSessionIndex((value) => value + 1);
          recordedRef.current = false;
          engine.restart();
        }}
        onHome={onExit}
      />
    );
  }

  return (
    <GameShell
      engine={engine}
      inputMethod={settings.inputMethod}
      imageMode={settings.imageMode}
      showImageHintDuringPlay={settings.showImageHintDuringPlay}
      settings={settings}
      onSpeechSpeedChange={(speed) => updateSettings({ speechSpeed: speed })}
      timed={false}
      totalQuestions={pool.length}
      progressLabel={`${engine.questionIndex + 1}/${pool.length}`}
      onExit={onExit}
      wrongMessageKey="reviewWrongHint"
      renderCard={(question) => (
        <>
          <p className="card__prompt" style={{ fontSize: "1.25rem", marginTop: 18 }}>
            {isSentenceQuestion(question) ? t("cardSentenceHint") : t("cardWordHint")}
          </p>
          <p className="note" style={{ marginTop: 6 }}>
            {t("reviewedCount", { n: mistakes[question.id]?.reviewCount ?? 0 })}
          </p>
        </>
      )}
    />
  );
}