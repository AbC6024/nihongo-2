import { useCallback, useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/AppStore";
import { useQuizEngine, type EngineResult } from "../hooks/useQuizEngine";
import { GameShell } from "../components/GameShell";
import { ResultView } from "../components/ResultView";
import { buildSessionQuestions, filterQuestions } from "../utils/randomQuestion";
import { playQuestionAudio } from "../services/speech";
import { playSfx } from "../services/sfx";
import { calculateAccuracy } from "../utils/scoring";
import { speechRateConfigFrom } from "../utils/speechRate";
import { toLocalDateKey } from "../utils/date";
import { BUILTIN_SENTENCES } from "../data/sentences";
import type { GameRecord } from "../types/game";
import type { Question } from "../types/question";
import { isSentenceQuestion } from "../types/question";
import { useI18n } from "../i18n";

interface Props {
  mode: "word" | "sentence";
  onExit: () => void;
  onReview: () => void;
}

export function PlayPage({ mode, onExit, onReview }: Props) {
  const { allWords, settings, recordAttempt, recordGame, registerWrong, updateSettings } =
    useAppStore();
  const { t } = useI18n();
  const startedAtRef = useRef(new Date().toISOString());
  const recordedRef = useRef(false);
  const [result, setResult] = useState<EngineResult | null>(null);

  /** 篩選後的題庫（依難度／分類）。 */
  const pool = useMemo(() => {
    const base = mode === "word" ? allWords : BUILTIN_SENTENCES;
    return filterQuestions(base, {
      difficulties: settings.difficulties,
      categories: settings.categories,
    });
  }, [mode, allWords, settings.difficulties, settings.categories]);

  /**
   * 這一局的題目順序。
   *
   * - 只在「題庫／模式變更」或「restart()」時重新洗牌。
   * - sessionIndex 每次 +1 就代表開始新局，因此會重新隨機。
   * - 元件重新渲染不會改變順序（useMemo 只在依賴改變時重算）。
   * - 題目數足夠時整局不重複；數量不足時以洗牌後的順序循環。
   */
  const [sessionIndex, setSessionIndex] = useState(0);
  const sessionQuestions = useMemo(
    () => buildSessionQuestions(pool, (question) => question.id).order,
    [pool, sessionIndex],
  );

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
      mode,
      settings,
      questions: sessionQuestions,
      timeLimitSeconds: settings.duration,
      skipPenalty: true,
      autoSpeak: true,
    },
    {
      onAttemptSettled: (attempt) => recordAttempt(attempt),
      onWrongRegistered: (questionId, gameMode, skipped) =>
        registerWrong(questionId, gameMode, skipped),
      onSfx: (name) => playSfx(name, { enabled: settings.sfxEnabled, volume: settings.sfxVolume }),
      onGameFinished: (finished) => {
        setResult(finished);
        if (recordedRef.current) return;
        recordedRef.current = true;
        const record: GameRecord = {
          id: `${mode}-${startedAtRef.current}`,
          startedAt: startedAtRef.current,
          endedAt: new Date().toISOString(),
          localDate: toLocalDateKey(),
          gameMode: mode,
          durationSeconds: settings.duration,
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

  const restart = () => {
    recordedRef.current = false;
    startedAtRef.current = new Date().toISOString();
    setResult(null);
    // 新局 → 重新隨機抽題
    setSessionIndex((index) => index + 1);
    engine.restart();
  };

  if (pool.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{t("emptyPoolTitle")}</p>
        <p>{t("emptyPoolDesc")}</p>
        <button type="button" className="btn" onClick={onExit}>
          {t("goHome")}
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <ResultView
        mode={mode}
        result={result}
        startedAt={startedAtRef.current}
        onRetry={restart}
        onHome={onExit}
        onReview={onReview}
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
      timed
      totalQuestions={null}
      progressLabel={`${engine.answeredCount}`}
      onExit={onExit}
      renderCard={(question) =>
        isSentenceQuestion(question) ? (
          <p className="card__sentence">{question.displaySentence}</p>
        ) : (
          <p className="card__prompt" style={{ fontSize: "1.25rem", marginTop: 18 }}>
            {t("cardWordHint")}
          </p>
        )
      }
    />
  );
}