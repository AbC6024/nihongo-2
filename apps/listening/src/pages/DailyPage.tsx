import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/AppStore";
import { useQuizEngine, type EngineResult } from "../hooks/useQuizEngine";
import { GameShell } from "../components/GameShell";
import { ResultView } from "../components/ResultView";
import { playQuestionAudio } from "../services/speech";
import { playSfx } from "../services/sfx";
import { toLocalDateKey } from "../utils/date";
import {
  completeDailyChallenge,
  getDailyQuestionIds,
  isDailyCompleted,
  saveDailyQuestionIds,
} from "../utils/dailyChallenge";
import { calculateAccuracy, DAILY_MAX_SCORE, DAILY_TOTAL_QUESTIONS } from "../utils/scoring";
import { speechRateConfigFrom } from "../utils/speechRate";
import { useI18n } from "../i18n";
import { filterQuestions } from "../utils/randomQuestion";
import type { DailyResult, GameRecord } from "../types/game";
import type { Question } from "../types/question";
import { isSentenceQuestion } from "../types/question";

interface Props {
  onExit: () => void;
}

export function DailyPage({ onExit }: Props) {
  const {
    allWords,
    settings,
    mistakes,
    daily,
    updateDaily,
    recordAttempt,
    recordGame,
    registerWrong,
    updateSettings,
  } = useAppStore();
  const { t } = useI18n();
  // 一局遊戲只會寫入一筆歷史紀錄；每次開始新局（+1）就重置。
  const [sessionIndex, setSessionIndex] = useState(0);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null);
  const startedAtRef = useRef(new Date().toISOString());
  // 一局遊戲只會寫入一筆歷史紀錄。
  const recordedRef = useRef(false);

  const dateKey = toLocalDateKey();

  /**
   * 今日挑戰的 10 題：每次「開始新局」都重新隨機抽取。
   * 前 5 題來自一般題庫，後 5 題優先來自錯題庫，不足時由一般題庫補足。
   * sessionIndex 改變即代表新局。
   */
  const dailyIds = useMemo(() => {
    const filtered = filterQuestions(allWords, {
      difficulties: settings.difficulties,
      categories: settings.categories,
    });
    return getDailyQuestionIds(
      daily,
      dateKey,
      filtered.map((item) => item.id),
      Object.keys(mistakes),
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWords, settings.difficulties, settings.categories, dateKey, sessionIndex]);

  /**
   * 保存當局抽到的題目 ID（除錯與資料備份用；**不會**鎖定下次抽題）。
   *
   * 必須比對後才寫入，否則每次 setDaily 都會觸發 effect 造成無限迴圈。
   */
  useEffect(() => {
    const saved = daily.lastDailyQuestionIds?.[dateKey];
    const sameAsSaved =
      Array.isArray(saved) &&
      saved.length === dailyIds.length &&
      saved.every((id, index) => id === dailyIds[index]);
    if (sameAsSaved) return;
    updateDaily(saveDailyQuestionIds(daily, dateKey, dailyIds));
  }, [daily, dailyIds, dateKey, updateDaily]);

  const questions = useMemo<Question[]>(() => {
    const byId = new Map(allWords.map((item) => [item.id, item]));
    const found: Question[] = [];
    for (const id of dailyIds) {
      const question = byId.get(id);
      if (question) found.push(question);
    }
    return found;
  }, [allWords, dailyIds]);

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
      mode: "daily",
      settings,
      questions,
      ordered: true,
      timeLimitSeconds: 0,
      // 今日挑戰不使用一般模式的 -50 跳過扣分。
      skipPenalty: false,
      dailyScoring: true,
      autoSpeak: true,
    },
    {
      onAttemptSettled: (attempt) => recordAttempt(attempt),
      onWrongRegistered: (questionId, gameMode, skipped) =>
        registerWrong(questionId, gameMode, skipped),
      onSfx: (name) => playSfx(name, { enabled: settings.sfxEnabled, volume: settings.sfxVolume }),
      onGameFinished: (finished) => {
        setResult(finished);
        const outcome = completeDailyChallenge({ dateKey, score: finished.score, record: daily });
        updateDaily(outcome.record);
        setDailyResult({
          dateKey,
          score: Math.min(finished.score, DAILY_MAX_SCORE),
          maxScore: DAILY_MAX_SCORE,
          correctCount: finished.correct,
          wrongCount: finished.wrong,
          skippedCount: finished.skipped,
          totalQuestions: DAILY_TOTAL_QUESTIONS,
          currentStreak: outcome.currentStreak,
          bestStreak: outcome.bestStreak,
          isNewWin: outcome.isNewWin,
        });
        if (recordedRef.current) return;
        recordedRef.current = true;
        const record: GameRecord = {
          id: `daily-${dateKey}-${sessionIndex}-${startedAtRef.current}`,
          startedAt: startedAtRef.current,
          endedAt: new Date().toISOString(),
          localDate: dateKey,
          gameMode: "daily",
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

  if (questions.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{t("dailyEmptyTitle")}</p>
        <p>{t("dailyEmptyDesc")}</p>
        <button type="button" className="btn" onClick={onExit}>
          {t("goHome")}
        </button>
      </div>
    );
  }

  if (result && dailyResult) {
    return (
      <ResultView
        mode="daily"
        result={result}
        startedAt={startedAtRef.current}
        dailyStreak={{
          current: dailyResult.currentStreak,
          best: dailyResult.bestStreak,
          isNewWin: dailyResult.isNewWin,
        }}
        onRetry={() => {
          setResult(null);
          setDailyResult(null);
          startedAtRef.current = new Date().toISOString();
          setSessionIndex((value) => value + 1);
          recordedRef.current = false;
          engine.restart();
        }}
        onHome={onExit}
      />
    );
  }

  const alreadyDone = isDailyCompleted(daily, dateKey);

  return (
    <>
      <div className={`banner ${alreadyDone ? "banner--info" : "banner--warn"}`}>
        {alreadyDone ? t("dailyDoneBanner") : t("dailyIntroBanner")}
      </div>
      <GameShell
        engine={engine}
        inputMethod={settings.inputMethod}
        imageMode={settings.imageMode}
        showImageHintDuringPlay={settings.showImageHintDuringPlay}
        timed={false}
        totalQuestions={DAILY_TOTAL_QUESTIONS}
        progressLabel={`${Math.min(engine.questionIndex + 1, DAILY_TOTAL_QUESTIONS)}/${DAILY_TOTAL_QUESTIONS}`}
        onExit={onExit}
        settings={settings}
      onSpeechSpeedChange={(speed) => updateSettings({ speechSpeed: speed })}
      scoreLabelKey="labelTodayScore"
        wrongMessageKey="dailyWrongHint"
        renderCard={(question) => (
          <p className="card__prompt" style={{ fontSize: "1.25rem", marginTop: 18 }}>
            {isSentenceQuestion(question) ? t("cardSentenceHint") : t("cardWordHint")}
          </p>
        )}
      />
    </>
  );
}