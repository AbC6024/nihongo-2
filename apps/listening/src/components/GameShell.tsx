import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EngineApi } from "../hooks/useQuizEngine";
import type { ImageMode, Question } from "../types/question";
import { isSentenceQuestion } from "../types/question";
import type { GameSettings, InputMethod } from "../types/game";
import { AnswerInput } from "./AnswerInput";
import { AnswerReveal } from "./AnswerReveal";
import { AudioButton } from "./AudioButton";
import { Hud, QuestionProgress } from "./QuestionProgress";
import { ImageHint } from "./ImageHint";
import { ReviewCountdown } from "./ReviewCountdown";
import { REVIEW_REVEAL_SECONDS } from "../utils/settings";
import { SpeechSpeedControl } from "./SpeechSpeedControl";
import { isSpeechSpeed, type SpeechSpeedMultiplier } from "../utils/speechRate";
import { useI18n, type TranslationKey } from "../i18n";

interface Props {
  engine: EngineApi;
  inputMethod: InputMethod;
  imageMode: ImageMode;
  showImageHintDuringPlay: boolean;
  /** 題目卡主內容（句子題會顯示挖空句）。 */
  renderCard: (question: Question) => ReactNode;
  /** 答錯時的提示訊息鍵值 */
  wrongMessageKey?: TranslationKey;
  onExit: () => void;
  timed: boolean;
  totalQuestions: number | null;
  progressLabel: string;
  scoreLabelKey?: TranslationKey;
  /** 完整設定：用於讀取語音速度，語音速度切換由外部處理。 */
  settings?: GameSettings;
  /** 切換題目語音速度（1× / 0.5×）。 */
  onSpeechSpeedChange?: (speed: SpeechSpeedMultiplier) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * 共用遊戲畫面。處理 READY 倒數、作答、跳過、答案揭示、結果顯示與鍵盤快捷鍵。
 */
export function GameShell({
  engine,
  inputMethod,
  imageMode,
  showImageHintDuringPlay,
  renderCard,
  wrongMessageKey = "wordWrongHint",
  onExit,
  timed,
  totalQuestions,
  progressLabel,
  scoreLabelKey = "labelScore",
  settings,
  onSpeechSpeedChange,
}: Props) {
  const { t } = useI18n();
  const {
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
    canSkipNow,
  } = engine;
  const [exitConfirm, setExitConfirm] = useState(false);
  const exitConfirmRef = useRef(false);

  const acceptingInput = phase === "PLAYING" || phase === "WRONG";
  const revealed = phase === "CORRECT" || phase === "SKIPPED";

  // 桌面快捷鍵：Enter 送出（由輸入框處理），Space 只在非編輯元素時重播音聲。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (exitConfirmRef.current) {
          setExitConfirm(false);
          exitConfirmRef.current = false;
          return;
        }
        if (
          phase === "PLAYING" ||
          phase === "WRONG" ||
          phase === "CORRECT" ||
          phase === "SKIPPED"
        ) {
          setExitConfirm(true);
          exitConfirmRef.current = true;
        }
        return;
      }
      if (event.code === "Space" || event.key === " ") {
        // 焦點在可編輯欄位時不觸發，避免干擾輸入空格
        if (isEditableTarget(event.target)) return;
        if (phase === "PLAYING" || phase === "WRONG" || revealed) {
          event.preventDefault();
          void engine.replayAudio();
        }
        return;
      }
      if (event.key === "Enter" && !isEditableTarget(event.target)) {
        // 遊戲結束或答案結算中：Enter 不得重複提交或重複計分。
        if (phase === "GAME_OVER" || phase === "READY") return;
        if (phase === "CORRECT" || phase === "SKIPPED") {
          if (question && engine.isSettled(question.id)) return;
        }
        event.preventDefault();
        engine.submit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine, phase, revealed, question]);

  useEffect(() => {
    if (phase !== "PLAYING") {
      exitConfirmRef.current = false;
      setExitConfirm(false);
    }
  }, [phase]);

  if (phase === "READY") {
    return (
      <div className="ready">
        <p className="card__eyebrow">{t("ready")}</p>
        <p className="ready__count">{readyCount || "GO"}</p>
        <p className="card__prompt">
          {inputMethod === "romaji" ? t("readyHintRomaji") : t("readyHintKana")}
        </p>
      </div>
    );
  }

  if (phase === "GAME_OVER" || !question) {
    return null;
  }

  const blankLabel = isSentenceQuestion(question) ? t("modeSentence") : t("modeWord");

  return (
    <div>
      {exitConfirm ? (
        <div className="banner banner--warn">
          {t("exitConfirm")}
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn--sm" onClick={() => setExitConfirm(false)}>
              {t("exitContinue")}
            </button>
            <button type="button" className="btn btn--sm btn--danger" onClick={onExit}>
              {t("exitLeave")}
            </button>
          </div>
        </div>
      ) : null}

      <Hud
        remainingMs={remainingMs}
        score={score}
        correct={correctCount}
        wrong={wrongCount}
        skipped={skippedCount}
        progressLabel={progressLabel}
        timed={timed}
        scoreLabelKey={scoreLabelKey}
      />
      <QuestionProgress current={answeredCount} total={totalQuestions} />

      <div className="card">
        <p className="card__eyebrow">
          {blankLabel} · {question.difficulty} · {question.category}
        </p>
        {renderCard(question)}
        <div className="btn-row" style={{ justifyContent: "center", marginTop: 14 }}>
          <AudioButton onClick={() => engine.replayAudio()} label={t("playAudio")} />
        </div>
        {showImageHintDuringPlay && (phase === "PLAYING" || phase === "WRONG") ? (
          <ImageHint question={question} mode={imageMode} />
        ) : null}
      </div>

      {revealed && lastReveal ? (
        <>
          <div className={`feedback feedback--${lastReveal.correct ? "correct" : "wrong"}`}>
            <div className="feedback__title">
              <span>
                {lastReveal.skipped ? t("skippedTitle") : lastReveal.correct ? t("correct") : t("retry")}
              </span>
              {lastReveal.correct ? <span>+{lastReveal.score}</span> : null}
            </div>
            <AnswerReveal
              question={question}
              gained={lastReveal.correct ? lastReveal.score : 0}
            />
          </div>
          <ImageHint question={question} mode={imageMode} />
        </>
      ) : null}

      {phase === "WRONG" ? (
        <div className="feedback feedback--wrong">
          <div className="feedback__title">
            <span>{t("retry")}</span>
            <span>{t("wrongCountLabel", { n: wrongAttempts })}</span>
          </div>
          <p className="feedback__meta">{t(wrongMessageKey)}</p>
        </div>
      ) : null}

      {phase === "PLAYING" || phase === "WRONG" ? (
        <>
          <form
            className="answer-form"
            onSubmit={(event) => {
              event.preventDefault();
              engine.submit();
            }}
          >
            <AnswerInput
              value={input}
              onChange={setInput}
              onSubmit={() => engine.submit()}
              disabled={!acceptingInput}
              inputMethod={inputMethod}
            />
            <button type="submit" className="btn btn--primary" disabled={!input.trim()}>
              {t("submit")}
            </button>
          </form>

          {canSkipNow ? (
            <div className="btn-row btn-row--skip">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => engine.skip()}
                disabled={engine.isSettled(question.id)}
              >
                {t("skipQuestion")}
              </button>
              <span className="note">{t("canSkipHint")}</span>
            </div>
          ) : null}
        </>
      ) : null}

      {revealed ? (
        <ReviewCountdown
          deadline={reviewDeadline}
          totalMs={REVIEW_REVEAL_SECONDS * 1000}
          onNext={() => engine.nextQuestion()}
        />
      ) : null}

      <p className="note" style={{ marginTop: 14 }}>
        {t("shortcutsHint")}
      </p>

      {settings && onSpeechSpeedChange ? (
        <SpeechSpeedControl
          settings={settings}
          onChange={(speed) => {
            if (isSpeechSpeed(speed)) onSpeechSpeedChange(speed);
          }}
        />
      ) : null}
    </div>
  );
}