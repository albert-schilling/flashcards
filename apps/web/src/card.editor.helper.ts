import { ZCard, type TCard } from "@flashcards/cards";
import { sameContent } from "./deck";

/** The Card types the editor can make; the others get their fields later. */
export const editableTypes = ["qa", "cloze", "true_false", "formula"] as const;
export type TEditableType = (typeof editableTypes)[number];
export type TEditableCard = Extract<TCard, { type: TEditableType }>;

export function isEditable(card: TCard): card is TEditableCard {
  return (editableTypes as readonly string[]).includes(card.type);
}

type TTexts = {
  question: string;
  answer: string;
  text: string;
  statement: string;
  name: string;
  wordFormula: string;
  readAloud: string;
  example: string;
};
type TTextKey = keyof TTexts;
type TBothTexts = { formula: string; latex: string };
type TBothKey = keyof TBothTexts;

/** The editor's input: every field of every editable type, so switching type keeps what was typed. `en` and `de` hold the texts per language, `both` the fields with one value for both languages. Tags are comma-separated. */
export type TCardForm = {
  type: TEditableType;
  id: string;
  lesson: string;
  domainTags: string;
  topicTags: string;
  en: TTexts;
  de: TTexts;
  both: TBothTexts;
  answer: boolean;
};

export type TFormField =
  | "id"
  | "lesson"
  | "tags.domain"
  | "tags.topic"
  | `en.${TTextKey}`
  | `de.${TTextKey}`
  | TBothKey;
export type TFieldProblem = "empty" | "noGap" | "idFormat" | "idTaken";
export type TFieldErrors = Partial<Record<TFormField, TFieldProblem>>;

/** The text fields of each editable type, in the order the editor shows them. */
export const textFields: Record<TEditableType, TTextKey[]> = {
  qa: ["question", "answer"],
  cloze: ["text"],
  true_false: ["statement"],
  formula: ["name", "wordFormula", "readAloud", "example"],
};

/** The fields of each editable type that hold one value for both languages, in the order the editor shows them; they sit at the Card's top level. */
export const bothFields: Record<TEditableType, TBothKey[]> = {
  qa: [],
  cloze: [],
  true_false: [],
  formula: ["formula", "latex"],
};

/** The text field a new Card's ID is suggested from, per editable type. */
export const idSource: Record<TEditableType, TTextKey> = {
  qa: "question",
  cloze: "text",
  true_false: "statement",
  formula: "name",
};

const noTexts: TTexts = {
  question: "",
  answer: "",
  text: "",
  statement: "",
  name: "",
  wordFormula: "",
  readAloud: "",
  example: "",
};
const noBoth: TBothTexts = { formula: "", latex: "" };

/** The form for a Card, or an empty qa form when there is none. */
export function formFromCard(card?: TEditableCard): TCardForm {
  if (!card) {
    return {
      type: "qa",
      id: "",
      lesson: "",
      domainTags: "",
      topicTags: "",
      en: { ...noTexts },
      de: { ...noTexts },
      both: { ...noBoth },
      answer: true,
    };
  }
  return {
    type: card.type,
    id: card.id,
    lesson: card.lesson,
    domainTags: card.tags.domain.join(", "),
    topicTags: card.tags.topic.join(", "),
    en: { ...noTexts, ...card.en },
    de: { ...noTexts, ...card.translations?.de },
    both:
      card.type === "formula" ? { formula: card.formula, latex: card.latex ?? "" } : { ...noBoth },
    answer: card.type === "true_false" ? card.answer : true,
  };
}

/** An ID from a Card's text: gap braces dropped, accents removed, lowercase, the first five words joined by hyphens; "" if no word is left. */
export function suggestId(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 5)
    .join("-");
}

function tagList(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Fields the schema lets a Card leave out: empty ones are dropped instead of failing as empty. */
export const optionalFields: ReadonlySet<string> = new Set(["readAloud", "example", "latex"]);

/** The values of `keys` from `values`, trimmed; empty ones are dropped with `skipEmpty` or when the field is optional. */
function pickTexts<TKey extends string>(
  keys: TKey[],
  values: Record<TKey, string>,
  skipEmpty: boolean,
) {
  const picked: Record<string, string> = {};
  for (const key of keys) {
    const value = values[key].trim();
    if (value !== "" || !(skipEmpty || optionalFields.has(key))) picked[key] = value;
  }
  return picked;
}

function candidate(form: TCardForm, version: number, sourceIds: string[]) {
  const german = pickTexts(textFields[form.type], form.de, true);
  return {
    id: form.id.trim(),
    version,
    tags: { domain: tagList(form.domainTags), topic: tagList(form.topicTags) },
    sourceIds,
    lesson: form.lesson.trim(),
    type: form.type,
    en: pickTexts(textFields[form.type], form.en, false),
    ...pickTexts(bothFields[form.type], form.both, false),
    ...(Object.keys(german).length > 0 && { translations: { de: german } }),
    ...(form.type === "true_false" && { answer: form.answer }),
  };
}

function valueAt(value: unknown, path: PropertyKey[]): unknown {
  return path.reduce<unknown>(
    (inner, key) => (inner as Record<PropertyKey, unknown>)?.[key],
    value,
  );
}

/** The form field a Zod issue path belongs to, or undefined for a path the form has no field for. */
function fieldOf(path: PropertyKey[]): TFormField | undefined {
  const [first, second, third] = path;
  if (first === "id" || first === "lesson") return first;
  if (first === "tags" && (second === "domain" || second === "topic")) return `tags.${second}`;
  if (typeof first === "string" && first in noBoth) return first as TBothKey;
  if (first === "en" && typeof second === "string") return `en.${second as TTextKey}`;
  if (first === "translations" && second === "de" && typeof third === "string") {
    return `de.${third as TTextKey}`;
  }
  return undefined;
}

/** Builds a Card from the form, or says what is wrong with each field. A new Card gets version 1 and no sources; an edited Card keeps its sources and gets the next version when its content changed, and its own ID is not taken. The Card schema (ZCard) decides what is valid; a taken ID is the one check it can't make. */
export function cardFromForm(
  form: TCardForm,
  context: { takenIds: string[]; editing?: TEditableCard },
): { card: TEditableCard } | { errors: TFieldErrors } {
  const { editing } = context;
  const input = candidate(form, editing?.version ?? 1, editing?.sourceIds ?? []);
  const parsed = ZCard.safeParse(input);
  const errors: TFieldErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = fieldOf(issue.path);
      if (!field || errors[field]) continue;
      const value = valueAt(input, issue.path);
      const blank = value === "" || (Array.isArray(value) && value.length === 0);
      errors[field] = blank ? "empty" : field === "id" ? "idFormat" : "noGap";
    }
  }
  if (!errors.id && input.id !== editing?.id && context.takenIds.includes(input.id)) {
    errors.id = "idTaken";
  }
  if (!parsed.success || Object.keys(errors).length > 0) return { errors };

  const card = parsed.data as TEditableCard;
  if (editing && !sameContent(card, editing))
    return { card: { ...card, version: card.version + 1 } };
  return { card };
}
