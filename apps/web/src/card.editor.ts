import { ZCard, type TCard } from "@flashcards/cards";
import { sameContent } from "./deck";

/** The Card types the Card editor can make; the others come later. */
export const editorTypes = ["qa", "cloze", "true_false"] as const;
export type TEditorType = (typeof editorTypes)[number];

/** Every field of the Card editor as the Learner types it; `domain` and `topic` are comma-separated lists. Fields of other types than `type` are ignored. */
export type TEditorFields = {
  type: TEditorType;
  id: string;
  lesson: string;
  domain: string;
  topic: string;
  question: string;
  answer: string;
  text: string;
  statement: string;
  truth: "true" | "false";
  deQuestion: string;
  deAnswer: string;
  deText: string;
  deStatement: string;
};

/** What is wrong with a field: empty, an ID not in the ID format, a cloze text without a {{gap}}, or an ID a stored Card has. */
export type TFieldError = "required" | "format" | "gap" | "duplicate";
export type TFieldErrors = Partial<Record<keyof TEditorFields, TFieldError>>;

/** The editor's fields for this Card, or empty ones for a new qa Card. Tags are joined by commas. A Card of a type the editor doesn't have gives the empty fields. */
export function fieldsFromCard(card?: TCard): TEditorFields {
  const fields: TEditorFields = {
    type: "qa",
    id: "",
    lesson: "",
    domain: "",
    topic: "",
    question: "",
    answer: "",
    text: "",
    statement: "",
    truth: "true",
    deQuestion: "",
    deAnswer: "",
    deText: "",
    deStatement: "",
  };
  if (card === undefined) return fields;
  const shared = {
    id: card.id,
    lesson: card.lesson,
    domain: card.tags.domain.join(", "),
    topic: card.tags.topic.join(", "),
  };
  switch (card.type) {
    case "qa":
      return {
        ...fields,
        ...shared,
        type: "qa",
        question: card.en.question,
        answer: card.en.answer,
        deQuestion: card.translations?.de.question ?? "",
        deAnswer: card.translations?.de.answer ?? "",
      };
    case "cloze":
      return {
        ...fields,
        ...shared,
        type: "cloze",
        text: card.en.text,
        deText: card.translations?.de.text ?? "",
      };
    case "true_false":
      return {
        ...fields,
        ...shared,
        type: "true_false",
        statement: card.en.statement,
        truth: card.answer ? "true" : "false",
        deStatement: card.translations?.de.statement ?? "",
      };
    default:
      return fields;
  }
}

/** An ID for a Card with this question, text or statement: its first 5 words, without accents, in lowercase and joined by hyphens. "" when it has no letters or digits. */
export function suggestId(text: string): string {
  const plain = text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return (plain.toLowerCase().match(/[a-z0-9]+/g) ?? []).slice(0, 5).join("-");
}

function splitTags(list: string): string[] {
  return list
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** The English texts and the other fields of the Card by type, and its German texts when any is filled in; empty German texts are left out. */
function typeFields(fields: TEditorFields) {
  const german = (entries: Record<string, string>) => {
    const de = Object.fromEntries(
      Object.entries(entries)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value !== ""),
    );
    return Object.keys(de).length > 0 ? { translations: { de } } : {};
  };
  switch (fields.type) {
    case "qa":
      return {
        en: { question: fields.question.trim(), answer: fields.answer.trim() },
        ...german({ question: fields.deQuestion, answer: fields.deAnswer }),
      };
    case "cloze":
      return { en: { text: fields.text.trim() }, ...german({ text: fields.deText }) };
    case "true_false":
      return {
        en: { statement: fields.statement.trim() },
        ...german({ statement: fields.deStatement }),
        answer: fields.truth === "true",
      };
  }
}

/** The editor field a Zod issue path belongs to, if any. */
function fieldOf(path: PropertyKey[]): keyof TEditorFields | undefined {
  const [first, second] = path;
  if (first === "id" || first === "lesson") return first;
  if (first === "tags" && (second === "domain" || second === "topic")) return second;
  if (first === "en" && typeof second === "string") return second as keyof TEditorFields;
  const third = path[2];
  if (first === "translations" && second === "de" && typeof third === "string") {
    return `de${third[0]?.toUpperCase()}${third.slice(1)}` as keyof TEditorFields;
  }
  if (first === "answer") return "truth";
  return undefined;
}

function isEmpty(fields: TEditorFields, field: keyof TEditorFields): boolean {
  const value = fields[field];
  return field === "domain" || field === "topic" ? splitTags(value).length === 0 : !value.trim();
}

/**
 * Makes the Card from the editor's fields, or names each field that is wrong. The schema decides what is valid; its issues become error codes.
 * A new Card (no `editing`) is at version 1 with no sources and its ID must not be in `stored`. An edited Card keeps its ID and sources, and its version goes up by 1 only when its content changed.
 */
export function buildCard(
  fields: TEditorFields,
  stored: TCard[],
  editing?: TCard,
): { card: TCard } | { errors: TFieldErrors } {
  const result = ZCard.safeParse({
    id: fields.id.trim(),
    version: editing?.version ?? 1,
    tags: { domain: splitTags(fields.domain), topic: splitTags(fields.topic) },
    sourceIds: editing?.sourceIds ?? [],
    lesson: fields.lesson.trim(),
    type: fields.type,
    ...typeFields(fields),
  });

  if (!result.success) {
    const errors: TFieldErrors = {};
    for (const issue of result.error.issues) {
      const field = fieldOf(issue.path);
      if (field === undefined || errors[field]) continue;
      if (isEmpty(fields, field)) errors[field] = "required";
      else if (field === "id") errors[field] = "format";
      else if (field === "text" || field === "deText") errors[field] = "gap";
    }
    return { errors };
  }

  const card = result.data;
  if (editing === undefined) {
    return stored.some((each) => each.id === card.id) ? { errors: { id: "duplicate" } } : { card };
  }
  return { card: sameContent(card, editing) ? card : { ...card, version: card.version + 1 } };
}
