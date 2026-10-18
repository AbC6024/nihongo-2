import type { Question } from "../types/question";
import { isSentenceQuestion } from "../types/question";

interface Props {
  question: Question;
  /** 本題獲得的分數（答對時）。 */
  gained: number;
  showExample?: boolean;
}

function kanaOf(question: Question): string | undefined {
  return question.kana;
}

function romajiOf(question: Question): string | undefined {
  return question.romaji;
}

function meaningOf(question: Question): string | undefined {
  return question.meaning;
}

function exampleOf(question: Question): string | undefined {
  return isSentenceQuestion(question) ? undefined : question.example;
}

/**
 * 答案揭示卡。只在答對或跳過之後顯示；作答中不會渲染此元件。
 * 答案內容來自題目資料本身（中文詞義），屬於資料而非介面文字，因此不做翻譯。
 */
export function AnswerReveal({ question, gained, showExample = true }: Props) {
  const sentence = isSentenceQuestion(question) ? question.sentence : null;
  const kana = kanaOf(question);
  const romaji = romajiOf(question);
  const meaning = meaningOf(question);
  const example = showExample ? exampleOf(question) : undefined;
  const primary = isSentenceQuestion(question) ? question.answer : question.japanese;

  return (
    <div>
      {sentence ? <p className="card__sentence">{sentence}</p> : null}
      <p className="feedback__answer">{primary}</p>
      <div className="feedback__meta">
        {kana ? <div>{kana}</div> : null}
        {romaji ? <div>{romaji}</div> : null}
        {meaning ? <div>{meaning}</div> : null}
      </div>
      {example ? <p className="feedback__example">{example}</p> : null}
      {gained > 0 ? <p className="feedback__meta">+{gained}</p> : null}
    </div>
  );
}