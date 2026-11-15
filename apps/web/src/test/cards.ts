import type { TCard, TCardMultipleChoice, TCardQA, TCardTrueFalse } from "@flashcards/cards";

const shared = {
  tags: { domain: ["Machine Learning"], topic: ["Decision Tree"] },
  sourceIds: [],
  lesson: "lesson-04",
};

/** A valid qa Card; the question names its ID. */
export function qa(id: string, version: number, answer = "An answer."): TCardQA {
  return { id, version, ...shared, type: "qa", en: { question: `What is ${id}?`, answer } };
}

/** A valid true_false Card. */
export function trueFalse(id: string, version: number): TCardTrueFalse {
  return {
    id,
    version,
    ...shared,
    type: "true_false",
    en: { statement: `${id} is true.` },
    answer: true,
  };
}

/** A valid multiple_choice Card. */
export function multipleChoice(id: string, version: number): TCardMultipleChoice {
  return {
    id,
    version,
    ...shared,
    type: "multiple_choice",
    en: { question: `Which is ${id}?`, options: ["This", "That"], explanation: "This one." },
    answerIndex: 0,
  };
}

/** The Card with these domain and topic tags. */
export function tagged<T extends TCard>(card: T, domain: string[], topic: string[]): T {
  return { ...card, tags: { domain, topic } };
}
