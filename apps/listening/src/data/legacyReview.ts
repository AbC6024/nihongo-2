import legacyQuestions from "./legacyQuestions.json";
import type { Question } from "../types/question";
import type { MistakeEntry } from "../types/game";

// Preserve existing mistake IDs without adding the retired bank to new lessons.
const legacyById = new Map((legacyQuestions as Question[]).map(question => [question.id, question]));

export function questionsForReview(words: Question[], mistakes: Record<string, MistakeEntry>): Question[] {
  const byId = new Map(words.map(question => [question.id, question]));
  for (const id of Object.keys(mistakes)) {
    const question = legacyById.get(id);
    if (question && !byId.has(id)) byId.set(id, question);
  }
  return [...byId.values()];
}
