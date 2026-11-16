import type {
  TCard,
  TCardCloze,
  TCardFormula,
  TCardMultipleChoice,
  TCardNumeric,
  TCardQA,
  TCardTrueFalse,
} from "@flashcards/cards";
import type { TReview } from "../storage";

const shared = {
  tags: { domain: ["Machine Learning"], topic: ["Decision Tree"] },
  sourceIds: [],
  lesson: "lesson-04",
};

/** A valid qa Card; the question names its ID. */
export function qa(id: string, version: number, answer = "An answer."): TCardQA {
  return { id, version, ...shared, type: "qa", en: { question: `What is ${id}?`, answer } };
}

/** A valid true_false Card; the statement names its ID. */
export function trueFalse(id: string, version: number, answer = true): TCardTrueFalse {
  return {
    id,
    version,
    ...shared,
    type: "true_false",
    en: { statement: `${id} is true.` },
    answer,
  };
}

/** A valid cloze Card. */
export function cloze(id: string, version: number, text = `${id} has a {{gap}}.`): TCardCloze {
  return { id, version, ...shared, type: "cloze", en: { text } };
}

/** A valid formula Card; the name names its ID. */
export function formula(id: string, version: number, example?: string): TCardFormula {
  return {
    id,
    version,
    ...shared,
    type: "formula",
    en: {
      name: `The ${id} formula`,
      wordFormula: `${id} is a times b.`,
      ...(example === undefined ? {} : { example }),
    },
    formula: `${id} = a · b`,
  };
}

/** A valid numeric Card: answer 5, allowed error 0.01; the question names its ID. */
export function numeric(id: string, version: number, unit?: string): TCardNumeric {
  return {
    id,
    version,
    ...shared,
    type: "numeric",
    en: { question: `How much is ${id}?` },
    answer: 5,
    allowedError: 0.01,
    ...(unit === undefined ? {} : { unit }),
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

/** A Review of this version of the Card, answered at this ISO time, that took 3 seconds. */
export function review(
  cardId: string,
  cardVersion: number,
  answeredAt: string,
  right = true,
): TReview {
  return { cardId, cardVersion, answeredAt, right, durationMs: 3000 };
}

/** The Card with these domain and topic tags. */
export function tagged<T extends TCard>(card: T, domain: string[], topic: string[]): T {
  return { ...card, tags: { domain, topic } };
}
