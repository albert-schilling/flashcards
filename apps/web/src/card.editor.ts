import {
  ZCard,
  type TCard,
  type TCardCloze,
  type TCardQA,
  type TCardTrueFalse,
} from "@flashcards/cards";

/** The Card types the editor makes; formula, multiple_choice and numeric come later. */
export const editorTypes = ["qa", "cloze", "true_false"] as const;
export type TEditorType = (typeof editorTypes)[number];
export type TEditableCard = TCardQA | TCardCloze | TCardTrueFalse;

/** The editor's form: every text as typed, tags comma-separated, German texts empty when missing. */
export type TCardDraft = {
  type: TEditorType;
  id: string;
  lesson: string;
  domainTags: string;
  topicTags: string;
  question: string;
  answer: string;
  text: string;
  statement: string;
  isTrue: boolean;
  germanQuestion: string;
  germanAnswer: string;
  germanText: string;
  germanStatement: string;
};

/** A draft field that holds text as typed. */
export type TDraftText = Exclude<keyof TCardDraft, "type" | "isTrue">;

/** What is wrong with one field. */
export type TFieldError = "required" | "noGap" | "idFormat" | "idTaken";
export type TDraftErrors = Partial<Record<keyof TCardDraft, TFieldError>>;

// The Card schema's ID format and cloze gap.
const idFormat = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
const gap = /\{\{.+?\}\}/;

/** An empty draft for a new qa Card. */
export function emptyDraft(): TCardDraft {
  return {
    type: "qa",
    id: "",
    lesson: "",
    domainTags: "",
    topicTags: "",
    question: "",
    answer: "",
    text: "",
    statement: "",
    isTrue: true,
    germanQuestion: "",
    germanAnswer: "",
    germanText: "",
    germanStatement: "",
  };
}

/** Whether the editor can edit this Card: qa, cloze or true_false. */
export function isEditable(card: TCard): card is TEditableCard {
  return (editorTypes as readonly string[]).includes(card.type);
}

/** The draft of a stored Card, to edit it. */
export function draftOf(card: TEditableCard): TCardDraft {
  const draft: TCardDraft = {
    ...emptyDraft(),
    type: card.type,
    id: card.id,
    lesson: card.lesson,
    domainTags: card.tags.domain.join(", "),
    topicTags: card.tags.topic.join(", "),
  };
  switch (card.type) {
    case "qa":
      return {
        ...draft,
        question: card.en.question,
        answer: card.en.answer,
        germanQuestion: card.translations?.de.question ?? "",
        germanAnswer: card.translations?.de.answer ?? "",
      };
    case "cloze":
      return { ...draft, text: card.en.text, germanText: card.translations?.de.text ?? "" };
    case "true_false":
      return {
        ...draft,
        statement: card.en.statement,
        isTrue: card.answer,
        germanStatement: card.translations?.de.statement ?? "",
      };
  }
}

/** An ID from a text: lowercase words of letters and digits joined by hyphens, accents dropped, at most six words; "" if the text has none. */
export function suggestId(text: string): string {
  const words = text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ß", "ss")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return words.slice(0, 6).join("-");
}

function tagList(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// Each type's Card texts: the draft field of the English text, named as in the Card, and of the German one.
const cardTexts = {
  qa: [
    ["question", "germanQuestion"],
    ["answer", "germanAnswer"],
  ],
  cloze: [["text", "germanText"]],
  true_false: [["statement", "germanStatement"]],
} as const satisfies Record<TEditorType, readonly (readonly [TDraftText, TDraftText])[]>;

// The type's English and German texts, trimmed, keyed as in the Card; an empty German text is left out.
function texts(draft: TCardDraft) {
  const en: Record<string, string> = {};
  const de: Record<string, string> = {};
  for (const [key, germanKey] of cardTexts[draft.type]) {
    en[key] = draft[key].trim();
    if (draft[germanKey].trim()) de[key] = draft[germanKey].trim();
  }
  return { en, de };
}

function errorsOf(draft: TCardDraft, takenIds: string[], edited?: TCard): TDraftErrors {
  const errors: TDraftErrors = {};
  for (const [key, germanKey] of cardTexts[draft.type]) {
    const english = draft[key].trim();
    const german = draft[germanKey].trim();
    if (!english) errors[key] = "required";
    else if (key === "text" && !gap.test(english)) errors[key] = "noGap";
    if (key === "text" && german && !gap.test(german)) errors[germanKey] = "noGap";
  }

  const id = draft.id.trim();
  if (!id) errors.id = "required";
  else if (!idFormat.test(id)) errors.id = "idFormat";
  else if (id !== edited?.id && takenIds.includes(id)) errors.id = "idTaken";

  if (tagList(draft.domainTags).length === 0) errors.domainTags = "required";
  if (tagList(draft.topicTags).length === 0) errors.topicTags = "required";
  if (!draft.lesson.trim()) errors.lesson = "required";
  return errors;
}

/** The Card a draft makes: version 1 for a new Card, or the edited Card's version + 1, keeping its sourceIds. `takenIds` are the stored Cards' IDs; the edited Card's own ID is not a conflict. Gives the errors of each field instead when the draft is not a valid Card. */
export function cardOf(
  draft: TCardDraft,
  takenIds: string[],
  edited?: TCard,
): { ok: true; card: TCard } | { ok: false; errors: TDraftErrors } {
  const errors = errorsOf(draft, takenIds, edited);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const { en, de } = texts(draft);
  // Parsing puts the keys in the schema's order, as an upload does, so a downloaded Deck uploads again unchanged.
  const card = ZCard.parse({
    id: draft.id.trim(),
    version: edited ? edited.version + 1 : 1,
    tags: { domain: tagList(draft.domainTags), topic: tagList(draft.topicTags) },
    sourceIds: edited?.sourceIds ?? [],
    lesson: draft.lesson.trim(),
    type: draft.type,
    en,
    ...(Object.keys(de).length > 0 && { translations: { de } }),
    ...(draft.type === "true_false" && { answer: draft.isTrue }),
  });
  return { ok: true, card };
}
