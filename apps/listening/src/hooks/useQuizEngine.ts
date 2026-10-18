import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMode, GameState as Phase, GameSettings, QuestionAttempt } from "../types/game";
import type { Question } from "../types/question";
import { isSentenceQuestion } from "../types/question";
import { isAnswerCorrect } from "../utils/answerMatcher";
import {
  applySkipPenalty,
  calculateDailyScore,
  calculateNormalScore,
  canSkip,
} from "../utils/scoring";
import { toLocalDateKey } from "../utils/date";
import { stopAllAudio } from "../services/speech";
import { SFX_SPEECH_GAP_MS, type SfxName } from "../services/sfx";

/**
 * 共用題目引擎：一般單字、句子填空、今日挑戰、複習模式皆使用此引擎，
 * 確保計時、結算、防止重複計分等規則只有一份實作。
 */

export interface EngineResult {
  attempts: QuestionAttempt[];
  answered: number;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
}

export interface EngineCallbacks {
  onAttemptSettled: (attempt: QuestionAttempt) => void;
  onWrongRegistered: (questionId: string, mode: GameMode, skipped: boolean) => void;
  onGameFinished: (result: EngineResult) => void;
  onQuestionChanged?: (question: Question | null) => void;
  /**
   * 提示音效觸發。由引擎在**確定判定結果後**呼叫一次，
   * 避免把音效放在會重複執行的畫面渲染邏輯中。
   */
  onSfx?: (name: SfxName) => void;
}

export interface EngineConfig {
  mode: GameMode;
  settings: GameSettings;
  /** 依序要出的題目（今日挑戰與複習模式傳入；一般模式傳入篩選後的題庫）。 */
  questions: Question[];
  /** 有序題目清單（今日挑戰）：依序出題，不隨機。 */
  ordered?: boolean;
  /** 限時秒數；0 或 undefined 表示不限時（複習模式、句子練習）。 */
  timeLimitSeconds?: number;
  /** 跳過是否扣總分 50：一般模式 true，今日挑戰／複習模式 false。 */
  skipPenalty: boolean;
  /** 今日挑戰計分：true 時每題答對固定 +200。 */
  dailyScoring?: boolean;
  /** 答題時自動播放音聲。 */
  autoSpeak?: boolean;
}

export interface EngineApi {
  phase: Phase;
  question: Question | null;
  input: string;
  setInput: (value: string) => void;
  wrongAttempts: number;
  score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  answeredCount: number;
  remainingMs: number;
  readyCount: number;
  /** 複習模式答案揭示倒數的截止時間戳；null 表示沒有倒數。 */
  reviewDeadline: number | null;
  lastReveal: { correct: boolean; score: number; skipped: boolean } | null;
  canSkipNow: boolean;
  submit: () => void;
  skip: () => void;
  nextQuestion: () => void;
  replayAudio: () => Promise<void>;
  isSettled: (questionId: string) => boolean;
  questionIndex: number;
  totalQuestions: number;
  finishedResult: EngineResult | null;
  endGame: () => void;
  restart: () => void;
}

const READY_STEPS = [3, 2, 1];

export function useQuizEngine(
  config: EngineConfig,
  callbacks: EngineCallbacks,
  speak: (question: Question) => Promise<unknown>,
): EngineApi {
  const {
    mode,
    settings,
    questions,
    ordered = false,
    timeLimitSeconds = 0,
    skipPenalty,
    dailyScoring = false,
    autoSpeak = true,
  } = config;

  const [phase, setPhase] = useState<Phase>("READY");
  const [readyCount, setReadyCount] = useState(READY_STEPS[0]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [input, setInput] = useState("");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [remainingMs, setRemainingMs] = useState(timeLimitSeconds * 1000);
  const [lastReveal, setLastReveal] = useState<EngineApi["lastReveal"]>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [finishedResult, setFinishedResult] = useState<EngineResult | null>(null);

  const settledRef = useRef<Set<string>>(new Set());
  const attemptsRef = useRef<QuestionAttempt[]>([]);
  const countsRef = useRef({ correct: 0, wrong: 0, skipped: 0, answered: 0, score: 0 });
  const questionStartRef = useRef<number>(Date.now());
  const endTimeRef = useRef<number | null>(null);
  const sessionIdRef = useRef(0);
  const autoNextTimerRef = useRef<number | null>(null);
  const deferredSpeakRef = useRef<number | null>(null);
  const reviewDeadlineRef = useRef<number | null>(null);
  const [reviewDeadline, setReviewDeadline] = useState<number | null>(null);
  const finishedRef = useRef(false);
  const phaseRef = useRef<Phase>("READY");

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // speak 通常由父元件以 useCallback 建立，但為避免 READY 倒數與自動跳題
  // 因參照變動而重複重啟，這裡固定讀取最新實作。
  const speakRef = useRef(speak);
  speakRef.current = speak;

  const pool = useMemo(() => questions, [questions]);

  /**
   * 發出提示音效。音效本身是 fire-and-forget（不 await），
   * 絕對不會延遲計分、答案揭示或自動跳題。
   */
  const emitSfx = useCallback((name: SfxName) => {
    try {
      callbacksRef.current.onSfx?.(name);
    } catch {
      /* 音效失敗不影響遊戲流程 */
    }
  }, []);

  /** 音效是否啟用（只影響提示音效，不影響題目語音）。 */
  const sfxEnabled = settings.sfxEnabled !== false;

  /** 答錯後延遲重播題目語音，避免與答錯音效重疊。 */
  const speakAfterSfx = useCallback(
    (question: Question, gapMs: number) => {
      if (gapMs <= 0) {
        void speakRef.current(question);
        return;
      }
      if (deferredSpeakRef.current !== null) window.clearTimeout(deferredSpeakRef.current);
      deferredSpeakRef.current = window.setTimeout(() => {
        deferredSpeakRef.current = null;
        // 若已經換題或結束，就不再重播上一題的語音。
        if (phaseRef.current === "GAME_OVER") return;
        if (settledRef.current.has(question.id)) return;
        void speakRef.current(question);
      }, gapMs);
    },
    [],
  );

  const cancelDeferredSpeak = useCallback(() => {
    if (deferredSpeakRef.current !== null) {
      window.clearTimeout(deferredSpeakRef.current);
      deferredSpeakRef.current = null;
    }
  }, []);

  const clearAutoNext = useCallback(() => {
    if (autoNextTimerRef.current !== null) {
      window.clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    reviewDeadlineRef.current = null;
    setReviewDeadline(null);
  }, []);

  /** 依序取出下一題；ordered 模式依固定順序，一般模式循環取用。 */
  const takeNext = useCallback(
    (index: number): Question | null => {
      if (pool.length === 0) return null;
      if (ordered) {
        return index < pool.length ? pool[index] : null;
      }
      return pool[index % pool.length];
    },
    [pool, ordered],
  );

  const finalize = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearAutoNext();
    cancelDeferredSpeak();
    stopAllAudio();
    const counts = countsRef.current;
    const result: EngineResult = {
      attempts: attemptsRef.current,
      answered: counts.answered,
      correct: counts.correct,
      wrong: counts.wrong,
      skipped: counts.skipped,
      score: counts.score,
    };
    setFinishedResult(result);
    setPhase("GAME_OVER");
    phaseRef.current = "GAME_OVER";
    callbacksRef.current.onGameFinished(result);
    // 一次結算只播放一次（finishedRef 已在上方擋住重複呼叫）。
    emitSfx("gameover");
  }, [clearAutoNext, cancelDeferredSpeak, emitSfx]);

  const enterQuestion = useCallback(
    (index: number, autoSpeakNext: boolean) => {
      const next = takeNext(index);
      if (!next) {
        finalize();
        return;
      }
      cancelDeferredSpeak();
      setQuestion(next);
      setQuestionIndex(index);
      setInput("");
      setWrongAttempts(0);
      setLastReveal(null);
      setPhase("PLAYING");
      phaseRef.current = "PLAYING";
      questionStartRef.current = Date.now();
      if (autoSpeakNext) {
        void speakRef.current(next);
      }
    },
    [takeNext, finalize, cancelDeferredSpeak],
  );

  const startGame = useCallback(() => {
    sessionIdRef.current += 1;
    settledRef.current = new Set();
    attemptsRef.current = [];
    countsRef.current = { correct: 0, wrong: 0, skipped: 0, answered: 0, score: 0 };
    finishedRef.current = false;
    setScore(0);
    setCorrectCount(0);
    setWrongCount(0);
    setSkippedCount(0);
    setAnsweredCount(0);
    setFinishedResult(null);
    setQuestionIndex(0);
    endTimeRef.current = timeLimitSeconds > 0 ? Date.now() + timeLimitSeconds * 1000 : null;
    setRemainingMs(timeLimitSeconds * 1000);
  }, [timeLimitSeconds]);

  // READY 倒數
  // 只依賴 phase / autoSpeak 這兩個穩定值：
  // 若依賴 enterQuestion / startGame，父層每次重新建立題目陣列就會重啟倒數。
  const startGameRef = useRef(startGame);
  startGameRef.current = startGame;
  const enterQuestionRef = useRef(enterQuestion);
  enterQuestionRef.current = enterQuestion;

  useEffect(() => {
    if (phase !== "READY") return undefined;
    const session = sessionIdRef.current;
    let step = 0;
    setReadyCount(READY_STEPS[0]);
    const timer = window.setInterval(() => {
      step += 1;
      if (session !== sessionIdRef.current) return;
      if (step >= READY_STEPS.length) {
        window.clearInterval(timer);
        setReadyCount(0);
        startGameRef.current();
        enterQuestionRef.current(0, autoSpeak);
      } else {
        setReadyCount(READY_STEPS[step]);
      }
    }, 800);
    return () => window.clearInterval(timer);
  }, [phase, autoSpeak]);

  const finalizeRef = useRef(finalize);
  finalizeRef.current = finalize;
  const poolSizeRef = useRef(pool.length);
  poolSizeRef.current = pool.length;
  const orderedRef = useRef(ordered);
  orderedRef.current = ordered;
  const questionIndexRef = useRef(questionIndex);
  questionIndexRef.current = questionIndex;

  // 限時計時：以時間戳差值計算，不依賴每秒累加。
  useEffect(() => {
    if (endTimeRef.current === null) return undefined;
    if (phase === "GAME_OVER") return undefined;
    const timer = window.setInterval(() => {
      const end = endTimeRef.current;
      if (end === null) return;
      const left = Math.max(0, end - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        window.clearInterval(timer);
        finalizeRef.current();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, timeLimitSeconds]);

  // 複習模式 10 秒揭示倒數
  useEffect(() => {
    if (reviewDeadline === null) return undefined;
    const timer = window.setInterval(() => {
      const deadline = reviewDeadlineRef.current;
      if (deadline === null) return;
      if (Date.now() >= deadline) {
        window.clearInterval(timer);
        reviewDeadlineRef.current = null;
        const nextIndex = questionIndexRef.current + 1;
        if (orderedRef.current && nextIndex >= poolSizeRef.current) {
          finalizeRef.current();
          return;
        }
        enterQuestionRef.current(nextIndex, autoSpeak);
      } else {
        setReviewDeadline(deadline);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [reviewDeadline, autoSpeak]);

  useEffect(() => () => {
    clearAutoNext();
    cancelDeferredSpeak();
    stopAllAudio();
  }, [clearAutoNext, cancelDeferredSpeak]);

  const settle = useCallback(
    (
      options: {
        correct: boolean;
        skipped: boolean;
        gained: number;
        totalAfter: number;
        responseTimeMs: number;
      },
    ) => {
      const current = question;
      if (!current) return false;
      if (settledRef.current.has(current.id)) return false;

      settledRef.current.add(current.id);
      const counts = countsRef.current;
      counts.answered += 1;
      counts.correct += options.correct ? 1 : 0;
      counts.wrong += options.correct ? 0 : 1;
      counts.skipped += options.skipped ? 1 : 0;
      counts.score = options.totalAfter;

      const attempt: QuestionAttempt = {
        timestamp: new Date().toISOString(),
        localDate: toLocalDateKey(),
        gameMode: mode,
        questionId: current.id,
        difficulty: current.difficulty,
        category: current.category,
        correct: options.correct,
        wrongAttempts,
        skipped: options.skipped,
        score: options.gained,
        responseTimeMs: options.responseTimeMs,
        inputMethod: settings.inputMethod,
      };
      attemptsRef.current = [...attemptsRef.current, attempt];
      callbacksRef.current.onAttemptSettled(attempt);

      setScore(options.totalAfter);
      setCorrectCount(counts.correct);
      setWrongCount(counts.wrong);
      setSkippedCount(counts.skipped);
      setAnsweredCount(counts.answered);
      return true;
    },
    [question, wrongAttempts, mode, settings.inputMethod],
  );

  const submit = useCallback(() => {
    const current = question;
    if (!current) return;
    if (phaseRef.current !== "PLAYING" && phaseRef.current !== "WRONG") return;
    if (settledRef.current.has(current.id)) return;
    const value = input.trim();
    if (!value) return;

    const responseTimeMs = Date.now() - questionStartRef.current;
    const correct = isAnswerCorrect(value, isSentenceQuestion(current)
      ? { japanese: current.answer, kana: current.kana, romaji: current.romaji, acceptedAnswers: current.acceptedAnswers }
      : { japanese: current.japanese, kana: current.kana, romaji: current.romaji, acceptedAnswers: current.acceptedAnswers });

    if (!correct) {
      const nextWrong = wrongAttempts + 1;
      setWrongAttempts(nextWrong);
      setWrongCount((prev) => prev + 1);
      setPhase("WRONG");
      phaseRef.current = "WRONG";
      callbacksRef.current.onWrongRegistered(current.id, mode, false);
      // 答錯音效在判定確定後才觸發；題目語音稍後再重播，避免重疊。
      emitSfx("wrong");
      speakAfterSfx(current, sfxEnabled ? SFX_SPEECH_GAP_MS : 0);
      return;
    }

    const gained = dailyScoring ? calculateDailyScore(true) : calculateNormalScore(wrongAttempts);
    const total = countsRef.current.score + gained;
    const ok = settle({ correct: true, skipped: false, gained, totalAfter: total, responseTimeMs });
    if (!ok) return;

    emitSfx("correct");
    cancelDeferredSpeak();
    setLastReveal({ correct: true, score: gained, skipped: false });
    setPhase("CORRECT");
    phaseRef.current = "CORRECT";

    const reviewMs = settings.reviewRevealMs;
    const revealMs = mode === "review" ? reviewMs : settings.revealCorrectMs;
    if (mode === "review") {
      const deadline = Date.now() + reviewMs;
      reviewDeadlineRef.current = deadline;
      setReviewDeadline(deadline);
    } else {
      const nextIndex = questionIndex + 1;
      autoNextTimerRef.current = window.setTimeout(() => {
        autoNextTimerRef.current = null;
        if (phaseRef.current === "GAME_OVER") return;
        if (ordered && nextIndex >= pool.length) {
          finalize();
          return;
        }
        if (endTimeRef.current !== null && Date.now() >= endTimeRef.current) {
          finalize();
          return;
        }
        enterQuestion(nextIndex, autoSpeak);
      }, revealMs);
    }
  }, [
    question,
    input,
    wrongAttempts,
    settle,
    dailyScoring,
    settings.reviewRevealMs,
    settings.revealCorrectMs,
    settings.sfxEnabled,
    sfxEnabled,
    emitSfx,
    speakAfterSfx,
    cancelDeferredSpeak,
    mode,
    questionIndex,
    pool.length,
    ordered,
    finalize,
    enterQuestion,
    autoSpeak,
  ]);

  const skip = useCallback(() => {
    const current = question;
    if (!current) return;
    if (phaseRef.current !== "PLAYING" && phaseRef.current !== "WRONG") return;
    if (settledRef.current.has(current.id)) return;
    if (!canSkip(wrongAttempts)) return;

    const responseTimeMs = Date.now() - questionStartRef.current;
    const total = skipPenalty ? applySkipPenalty(countsRef.current.score) : countsRef.current.score;
    const ok = settle({ correct: false, skipped: true, gained: 0, totalAfter: total, responseTimeMs });
    if (!ok) return;

    callbacksRef.current.onWrongRegistered(current.id, mode, true);
    // 只有真正結算成功才播跳過音效；連點跳過不會重複播放。
    emitSfx("skip");
    cancelDeferredSpeak();
    setLastReveal({ correct: false, score: 0, skipped: true });
    setPhase("SKIPPED");
    phaseRef.current = "SKIPPED";

    if (mode === "review") {
      const deadline = Date.now() + settings.reviewRevealMs;
      reviewDeadlineRef.current = deadline;
      setReviewDeadline(deadline);
    } else {
      const nextIndex = questionIndex + 1;
      autoNextTimerRef.current = window.setTimeout(() => {
        autoNextTimerRef.current = null;
        if (phaseRef.current === "GAME_OVER") return;
        if (ordered && nextIndex >= pool.length) {
          finalize();
          return;
        }
        if (endTimeRef.current !== null && Date.now() >= endTimeRef.current) {
          finalize();
          return;
        }
        enterQuestion(nextIndex, autoSpeak);
      }, settings.revealSkipMs);
    }
  }, [
    question,
    wrongAttempts,
    settle,
    skipPenalty,
    mode,
    settings.reviewRevealMs,
    settings.revealSkipMs,
    questionIndex,
    pool.length,
    ordered,
    finalize,
    enterQuestion,
    autoSpeak,
    emitSfx,
    cancelDeferredSpeak,
  ]);

  const nextQuestion = useCallback(() => {
    const current = question;
    // 結算中：Enter／下一題不得造成重複結算。
    if (phaseRef.current !== "CORRECT" && phaseRef.current !== "SKIPPED") return;
    if (current && !settledRef.current.has(current.id)) return;
    clearAutoNext();
    const nextIndex = questionIndex + 1;
    if (ordered && nextIndex >= pool.length) {
      finalize();
      return;
    }
    enterQuestion(nextIndex, autoSpeak);
  }, [mode, question, questionIndex, pool.length, ordered, clearAutoNext, finalize, enterQuestion, autoSpeak]);

  const replayAudio = useCallback(async () => {
    if (!question) return;
    await speakRef.current(question);
  }, [question]);

  const isSettled = useCallback((id: string) => settledRef.current.has(id), []);

  const endGame = useCallback(() => finalize(), [finalize]);

  const restart = useCallback(() => {
    clearAutoNext();
    stopAllAudio();
    setPhase("READY");
    phaseRef.current = "READY";
  }, [clearAutoNext]);

  return {
    phase,
    question,
    input,
    setInput,
    wrongAttempts,
    score,
    correctCount,
    wrongCount,
    skippedCount,
    answeredCount,
    remainingMs,
    readyCount,
    reviewDeadline,
    lastReveal,
    canSkipNow: canSkip(wrongAttempts),
    submit,
    skip,
    nextQuestion,
    replayAudio,
    isSettled,
    questionIndex,
    totalQuestions: pool.length,
    finishedResult,
    endGame,
    restart,
  };
}