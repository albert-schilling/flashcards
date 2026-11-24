import { ZCard, type TCard } from "@flashcards/cards";

/** The editor's text fields, all strings; `answer` is "true" or "false" for true_false. Fields that don't belong to `type` are ignored. */
export type TEditorForm = {
  type: "qa" | "cloze" | "true_false";
  id: string;
  lesson: string;
  domain: string;
  topic: string;
  question: string;
  answer: string;
  text: string;
  statement: string;
  de: { question: string; answer: string; text: string; statement: string };
};

type TTextField = keyof TEditorForm["de"];
type TOwnField = keyof Omit<TEditorForm, "type" | "de">;
export type TEditorField = TOwnField | `de.${TTextField}`;
export type TEditorError = "required" | "idFormat" | "idTaken" | "needsGap";

const maxIdLength = 40;

/** The text fields each type has; true_false also has the `answer` choice, which is not text. */
const textFields: Record<TEditorForm["type"], TTextField[]> = {
  qa: ["question", "answer"],
  cloze: ["text"],
  true_false: ["statement"],
};

export function emptyForm(type: TEditorForm["type"] = "qa"): TEditorForm {
  return {
    type,
    id: "",
    lesson: "",
    domain: "",
    topic: "",
    question: "",
    answer: type === "true_false" ? "true" : "",
    text: "",
    statement: "",
    de: { question: "", answer: "", text: "", statement: "" },
  };
}

/** Whether the editor can edit the Card: only the types of `TEditorForm`. */
export function isEditable(card: TCard): card is Extract<TCard, { type: TEditorForm["type"] }> {
  return card.type === "qa" || card.type === "cloze" || card.type === "true_false";
}

export function formFromCard(card: TCard): TEditorForm {
  if (!isEditable(card)) {
    throw new Error(`The editor can't edit a ${card.type} Card.`);
  }
  const form: TEditorForm = {
    ...emptyForm(card.type),
    id: card.id,
    lesson: card.lesson,
    domain: card.tags.domain.join(", "),
    topic: card.tags.topic.join(", "),
  };
  if (card.type === "qa") Object.assign(form, card.en);
  if (card.type === "cloze") form.text = card.en.text;
  if (card.type === "true_false") {
    form.statement = card.en.statement;
    form.answer = String(card.answer);
  }
  Object.assign(form.de, card.translations?.de);
  return form;
}

/** A suggested ID: lowercase words joined by hyphens, a cloze gap read as its word, at most 40 characters, -2, -3 ... added while a stored ID has it; "" when the text has no letter or digit. */
export function suggestId(text: string, storedIds: string[]): string {
  const words = text
    .replace(/\{\{(.*?)\}\}/g, "$1")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  let base = words.slice(0, maxIdLength);
  // A cut inside a word goes back to the hyphen before it.
  if (words.length > maxIdLength && words[maxIdLength] !== "-" && base.includes("-")) {
    base = base.slice(0, base.lastIndexOf("-"));
  }
  base = base.replace(/-$/, "");
  if (base === "") return "";
  let id = base;
  for (let n = 2; storedIds.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/** Whitespace-only text as empty; other text stays as typed, so an unchanged edit gives back the same Card. */
function blankToEmpty(value: string): string {
  return value.trim() === "" ? "" : value;
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

/** The Card the form makes, not yet checked. */
function draft(form: TEditorForm, id: string, version: number, sourceIds: string[]) {
  const fields = textFields[form.type];
  const en = Object.fromEntries(fields.map((name) => [name, blankToEmpty(form[name])]));
  const german = Object.fromEntries(
    fields.map((name) => [name, blankToEmpty(form.de[name])]).filter(([, value]) => value !== ""),
  );
  return {
    id,
    version,
    type: form.type,
    tags: { domain: splitTags(form.domain), topic: splitTags(form.topic) },
    sourceIds,
    lesson: blankToEmpty(form.lesson),
    en,
    ...(Object.keys(german).length > 0 ? { translations: { de: german } } : {}),
    ...(form.type === "true_false" ? { answer: form.answer === "true" } : {}),
  };
}

/** Whether the field holds nothing; the schema's message for an empty field is the same as for a wrong one. */
function isEmpty(form: TEditorForm, field: TEditorField): boolean {
  if (field === "domain" || field === "topic") return splitTags(form[field]).length === 0;
  const value = field.startsWith("de.")
    ? form.de[field.slice(3) as TTextField]
    : form[field as TOwnField];
  return value.trim() === "";
}

function fieldOf(path: PropertyKey[]): TEditorField | undefined {
  const [first, second, third] = path;
  if (first === "en" && typeof second === "string") return second as TEditorField;
  if (first === "translations" && typeof third === "string") return `de.${third}` as TEditorField;
  if (first === "tags" && (second === "domain" || second === "topic")) return second;
  if (first === "id" || first === "lesson") return first;
  return undefined;
}

/** The Card the form makes, or one error per invalid field. Creating (no `old`) is version 1 and rejects an ID in `storedIds`; editing keeps the ID and sourceIds and is `old.version + 1`, or `old` itself when the content is the same. */
export function checkForm(
  form: TEditorForm,
  storedIds: string[],
  old?: TCard,
): { card: TCard } | { errors: Partial<Record<TEditorField, TEditorError>> } {
  const id = old ? old.id : form.id.trim();
  const result = ZCard.safeParse(draft(form, id, old?.version ?? 1, old?.sourceIds ?? []));
  const errors: Partial<Record<TEditorField, TEditorError>> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = fieldOf(issue.path);
      if (!field || field in errors) continue;
      if (isEmpty(form, field)) errors[field] = "required";
      else errors[field] = field === "id" ? "idFormat" : "needsGap";
    }
  }
  // A taken ID shows with the other errors, so the Learner doesn't find it only on the next try.
  if (!old && !("id" in errors) && storedIds.includes(id)) errors.id = "idTaken";
  if (!result.success || "id" in errors) return { errors };
  if (!old) return { card: result.data };
  // Both sides are schema output, so their keys come in the same order and a JSON compare is valid.
  const same = JSON.stringify(result.data) === JSON.stringify(ZCard.parse(old));
  return { card: same ? old : { ...result.data, version: old.version + 1 } };
}
