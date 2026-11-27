import { ZCard, type TCard } from "@flashcards/cards";
import { sameContent } from "./deck";

/** In the order the Type select shows them. */
export const editableTypes = [
  "qa",
  "cloze",
  "true_false",
  "formula",
  "numeric",
  "multiple_choice",
] as const;
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
  explanation: string;
};
type TTextKey = keyof TTexts;
type TBothTexts = {
  formula: string;
  latex: string;
  answer: string;
  allowedError: string;
  unit: string;
};
type TBothKey = keyof TBothTexts;

export type TOption = { en: string; de: string };
export type TChoice = { options: TOption[]; answerIndex: number };

/** Every field of every editable type, so switching type keeps what was typed. Tags are comma-separated. */
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
  options: TOption[];
  answerIndex: number;
};

export type TFormField =
  | "id"
  | "lesson"
  | "tags.domain"
  | "tags.topic"
  | `en.${TTextKey}`
  | `de.${TTextKey}`
  | `${"en" | "de"}.options.${number}`
  | TBothKey;
export type TFieldProblem = "empty" | "noGap" | "idFormat" | "idTaken" | "negative";
export type TFieldErrors = Partial<Record<TFormField, TFieldProblem>>;

/** In the order the editor shows them. */
export const textFields: Record<TEditableType, TTextKey[]> = {
  qa: ["question", "answer"],
  cloze: ["text"],
  true_false: ["statement"],
  formula: ["name", "wordFormula", "readAloud", "example"],
  numeric: ["question"],
  multiple_choice: ["question", "explanation"],
};

/** Fields with one value for both languages; they sit at the Card's top level. */
export const bothFields: Record<TEditableType, TBothKey[]> = {
  qa: [],
  cloze: [],
  true_false: [],
  formula: ["formula", "latex"],
  numeric: ["answer", "allowedError", "unit"],
  multiple_choice: [],
};

export const idSource: Record<TEditableType, TTextKey> = {
  qa: "question",
  cloze: "text",
  true_false: "statement",
  formula: "name",
  numeric: "question",
  multiple_choice: "question",
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
  explanation: "",
};
/** Allowed error starts at 0. */
const noBoth: TBothTexts = { formula: "", latex: "", answer: "", allowedError: "0", unit: "" };

function bothOf(card: TEditableCard): TBothTexts {
  if (card.type === "formula") return { ...noBoth, formula: card.formula, latex: card.latex ?? "" };
  if (card.type === "numeric") {
    return {
      ...noBoth,
      answer: String(card.answer),
      allowedError: String(card.allowedError),
      unit: card.unit ?? "",
    };
  }
  return { ...noBoth };
}

/** A multiple_choice Card's `options` stay out of the form's texts. */
function textsOf(texts?: Record<string, unknown>): TTexts {
  const picked = { ...noTexts };
  for (const key of Object.keys(noTexts) as TTextKey[]) {
    const value = texts?.[key];
    if (typeof value === "string") picked[key] = value;
  }
  return picked;
}

/** "" where an option has no German text; any other Card gets two empty rows with the first right. */
function choiceOf(card?: TEditableCard): TChoice {
  if (card?.type !== "multiple_choice") {
    return {
      options: [
        { en: "", de: "" },
        { en: "", de: "" },
      ],
      answerIndex: 0,
    };
  }
  const german = card.translations?.de.options;
  return {
    options: card.en.options.map((en, index) => ({ en, de: german?.[index] ?? "" })),
    answerIndex: card.answerIndex,
  };
}

/** If the removed row is the right one, the first becomes right, as on a new Card. */
export function withoutOption(choice: TChoice, index: number): TChoice {
  const options = choice.options.filter((_, at) => at !== index);
  if (choice.answerIndex === index) return { options, answerIndex: 0 };
  return {
    options,
    answerIndex: choice.answerIndex > index ? choice.answerIndex - 1 : choice.answerIndex,
  };
}

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
      ...choiceOf(),
    };
  }
  return {
    type: card.type,
    id: card.id,
    lesson: card.lesson,
    domainTags: card.tags.domain.join(", "),
    topicTags: card.tags.topic.join(", "),
    en: textsOf(card.en),
    de: textsOf(card.translations?.de),
    both: bothOf(card),
    answer: card.type === "true_false" ? card.answer : true,
    ...choiceOf(card),
  };
}

/** Accents and gap braces drop out, so the result fits the Card ID format; "" if no word is left. */
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
export const optionalFields: ReadonlySet<string> = new Set([
  "readAloud",
  "example",
  "latex",
  "unit",
]);

/** Fields that hold a number: the form keeps them as typed, and a blank one stays "" so the schema reports it as empty. */
export const numberFields: ReadonlySet<string> = new Set(["answer", "allowedError"]);

function numbersIn(values: Record<string, string>): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      numberFields.has(key) && value !== "" ? Number(value) : value,
    ]),
  );
}

/** Empty values are dropped with `skipEmpty` or when the field is optional. */
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
  const german: Record<string, string | string[]> = pickTexts(textFields[form.type], form.de, true);
  const english: Record<string, string | string[]> = pickTexts(
    textFields[form.type],
    form.en,
    false,
  );
  if (form.type === "multiple_choice") {
    english.options = form.options.map((option) => option.en.trim());
    // In a Session, German options replace the English list as a whole, so they are all or none.
    const germanOptions = form.options.map((option) => option.de.trim());
    if (germanOptions.some(Boolean)) german.options = germanOptions;
  }
  return {
    id: form.id.trim(),
    version,
    tags: { domain: tagList(form.domainTags), topic: tagList(form.topicTags) },
    sourceIds,
    lesson: form.lesson.trim(),
    type: form.type,
    en: english,
    ...numbersIn(pickTexts(bothFields[form.type], form.both, false)),
    ...(Object.keys(german).length > 0 && { translations: { de: german } }),
    ...(form.type === "true_false" && { answer: form.answer }),
    ...(form.type === "multiple_choice" && { answerIndex: form.answerIndex }),
  };
}

function valueAt(value: unknown, path: PropertyKey[]): unknown {
  return path.reduce<unknown>(
    (inner, key) => (inner as Record<PropertyKey, unknown>)?.[key],
    value,
  );
}

/** Undefined for a path the form has no field for. */
function fieldOf(path: PropertyKey[]): TFormField | undefined {
  const [first, second, third, fourth] = path;
  if (first === "id" || first === "lesson") return first;
  if (first === "tags" && (second === "domain" || second === "topic")) return `tags.${second}`;
  if (typeof first === "string" && Object.hasOwn(noBoth, first)) return first as TBothKey;
  if (first === "en" && second === "options") {
    return typeof third === "number" ? `en.options.${third}` : undefined;
  }
  if (first === "translations" && second === "de" && third === "options") {
    return typeof fourth === "number" ? `de.options.${fourth}` : undefined;
  }
  if (first === "en" && typeof second === "string") return `en.${second as TTextKey}`;
  if (first === "translations" && second === "de" && typeof third === "string") {
    return `de.${third as TTextKey}`;
  }
  return undefined;
}

/** The problem of a non-blank value the schema rejects, per field; any other field lacks a gap. */
const rejected: Partial<Record<TFormField, TFieldProblem>> = {
  id: "idFormat",
  allowedError: "negative",
};

/** The Card schema (ZCard) decides what is valid; a taken ID is the one check it can't make. An edited Card keeps its sources and gets the next version only when its content changed. */
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
      errors[field] = blank ? "empty" : (rejected[field] ?? "noGap");
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
