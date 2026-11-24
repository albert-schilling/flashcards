import { ZCard, type TCard } from "@flashcards/cards";

/** The Card types the Card editor makes; the others come later. */
export const editableTypes = ["qa", "cloze", "true_false"] as const;

export type TEditableType = (typeof editableTypes)[number];

/** Whether the Card editor can edit this Card. */
export function isEditable(card: TCard): card is Extract<TCard, { type: TEditableType }> {
  return (editableTypes as readonly string[]).includes(card.type);
}

/** The Card editor's fields as typed. Each Card type uses its own text fields; tags are comma-separated. */
export type TDraft = {
  type: TEditableType;
  id: string;
  question: string;
  answer: string;
  text: string;
  statement: string;
  truth: boolean;
  questionDe: string;
  answerDe: string;
  textDe: string;
  statementDe: string;
  lesson: string;
  domainTags: string;
  topicTags: string;
};

export type TDraftField = keyof TDraft;

/** Why a field is invalid: empty, a cloze text with no `{{gap}}`, an ID not in the ID format, or the ID of another Card. */
export type TFieldError = "required" | "needsGap" | "idFormat" | "duplicateId";

export const emptyDraft: TDraft = {
  type: "qa",
  id: "",
  question: "",
  answer: "",
  text: "",
  statement: "",
  truth: true,
  questionDe: "",
  answerDe: "",
  textDe: "",
  statementDe: "",
  lesson: "",
  domainTags: "",
  topicTags: "",
};

/** The editor's fields for a stored Card. */
export function draftFromCard(card: Extract<TCard, { type: TEditableType }>): TDraft {
  const shared = {
    ...emptyDraft,
    type: card.type,
    id: card.id,
    lesson: card.lesson,
    domainTags: card.tags.domain.join(", "),
    topicTags: card.tags.topic.join(", "),
  };
  switch (card.type) {
    case "qa":
      return {
        ...shared,
        question: card.en.question,
        answer: card.en.answer,
        questionDe: card.translations?.de.question ?? "",
        answerDe: card.translations?.de.answer ?? "",
      };
    case "cloze":
      return { ...shared, text: card.en.text, textDe: card.translations?.de.text ?? "" };
    case "true_false":
      return {
        ...shared,
        statement: card.en.statement,
        truth: card.answer,
        statementDe: card.translations?.de.statement ?? "",
      };
  }
}

/** The English text an ID is suggested from: the question, the text or the statement. */
export function mainText(draft: TDraft): string {
  return { qa: draft.question, cloze: draft.text, true_false: draft.statement }[draft.type];
}

/** An ID from the first five words of the text: lowercase, accents dropped, ß as ss, words joined by hyphens. */
export function suggestId(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 5)
    .join("-");
}

const idFormat = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
const hasGap = /\{\{.+?\}\}/;

function tagList(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// German fields left empty are dropped, so they fall back to English.
function germanFields(fields: Record<string, string>) {
  const filled = Object.entries(fields)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value !== "");
  return filled.length > 0 ? { translations: { de: Object.fromEntries(filled) } } : {};
}

/**
 * Makes a Card from the editor's fields, or gives the error of each invalid field.
 * A new Card (no `stored`) gets version 1 and must not take an ID in `takenIds`; an edited one keeps its ID and source IDs and gets the next version, unless its content is unchanged.
 */
export function cardFromDraft(
  draft: TDraft,
  takenIds: string[],
  stored?: TCard,
): { card: TCard } | { errors: Partial<Record<TDraftField, TFieldError>> } {
  const errors: Partial<Record<TDraftField, TFieldError>> = {};
  const required: TDraftField[] = [
    "id",
    "lesson",
    "domainTags",
    "topicTags",
    ...({ qa: ["question", "answer"], cloze: ["text"], true_false: ["statement"] } as const)[
      draft.type
    ],
  ];
  for (const field of required) {
    const value = draft[field];
    const empty = field.endsWith("Tags")
      ? tagList(String(value)).length === 0
      : !String(value).trim();
    if (empty) errors[field] = "required";
  }
  const id = stored?.id ?? draft.id.trim();
  if (!errors.id && !stored) {
    if (!idFormat.test(id)) errors.id = "idFormat";
    else if (takenIds.includes(id)) errors.id = "duplicateId";
  }
  if (draft.type === "cloze") {
    if (!errors.text && !hasGap.test(draft.text)) errors.text = "needsGap";
    if (draft.textDe.trim() && !hasGap.test(draft.textDe)) errors.textDe = "needsGap";
  }
  if (Object.keys(errors).length > 0) return { errors };

  const shared = {
    id,
    version: 1,
    tags: { domain: tagList(draft.domainTags), topic: tagList(draft.topicTags) },
    sourceIds: stored?.sourceIds ?? [],
    lesson: draft.lesson.trim(),
  };
  const raw = {
    qa: {
      ...shared,
      type: "qa",
      en: { question: draft.question.trim(), answer: draft.answer.trim() },
      ...germanFields({ question: draft.questionDe, answer: draft.answerDe }),
    },
    cloze: {
      ...shared,
      type: "cloze",
      en: { text: draft.text.trim() },
      ...germanFields({ text: draft.textDe }),
    },
    true_false: {
      ...shared,
      type: "true_false",
      en: { statement: draft.statement.trim() },
      ...germanFields({ statement: draft.statementDe }),
      answer: draft.truth,
    },
  }[draft.type];
  // Parsing gives the schema's key order, so the content compares equal to a stored Card's.
  const card = ZCard.parse(raw);
  if (!stored) return { card };
  const unchanged = JSON.stringify({ ...card, version: stored.version }) === JSON.stringify(stored);
  return { card: { ...card, version: unchanged ? stored.version : stored.version + 1 } };
}
