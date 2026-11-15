import type { TCardQA } from "@flashcards/cards";

/** A valid qa Card; the question names its ID. */
export function qa(id: string, version: number, answer = "An answer."): TCardQA {
  return {
    id,
    version,
    tags: { domain: ["Machine Learning"], topic: ["Decision Tree"] },
    sourceIds: [],
    lesson: "lesson-04",
    type: "qa",
    en: { question: `What is ${id}?`, answer },
  };
}
