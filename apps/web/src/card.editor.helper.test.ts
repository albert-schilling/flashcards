import { ZCard, type TCard } from "@flashcards/cards";
import { describe, expect, it } from "vitest";
import {
  cardFromForm,
  formFromCard,
  isEditable,
  suggestId,
  type TCardForm,
  type TEditableCard,
} from "./card.editor.helper";
import {
  cloze,
  formula,
  fullFormula,
  german,
  multipleChoice,
  numeric,
  qa,
  trueFalse,
} from "./test/cards.fixtures";

const noTexts = {
  question: "",
  answer: "",
  text: "",
  statement: "",
  name: "",
  wordFormula: "",
  readAloud: "",
  example: "",
};
const noBoth = { formula: "", latex: "" };

/** A valid qa form; `changes` replace its fields, `en`, `de` and `both` field by field. */
function form(
  changes: Partial<Omit<TCardForm, "en" | "de" | "both">> & {
    en?: Partial<TCardForm["en"]>;
    de?: Partial<TCardForm["de"]>;
    both?: Partial<TCardForm["both"]>;
  } = {},
): TCardForm {
  const { en, de, both, ...rest } = changes;
  return {
    type: "qa",
    id: "ml.trees.leaf-mean",
    lesson: "lesson-04",
    domainTags: "Machine Learning",
    topicTags: "Decision Tree",
    answer: true,
    ...rest,
    en: { ...noTexts, question: "What is the leaf mean?", answer: "The mean.", ...en },
    de: { ...noTexts, ...de },
    both: { ...noBoth, ...both },
  };
}

/** The texts of a valid formula form, to put in `form`'s `en`. */
const formulaTexts = { name: "Vector norm", wordFormula: "The root of the summed squares." };

/** The Card the form makes; fails the test with the errors if it makes none. */
function made(form: TCardForm, context: Parameters<typeof cardFromForm>[1] = { takenIds: [] }) {
  const result = cardFromForm(form, context);
  if (!("card" in result)) throw new Error(`No Card: ${JSON.stringify(result.errors)}`);
  return result.card;
}

/** The field errors the form gives; fails the test if it makes a Card. */
function errors(form: TCardForm, context: Parameters<typeof cardFromForm>[1] = { takenIds: [] }) {
  const result = cardFromForm(form, context);
  if (!("errors" in result)) throw new Error(`Made a Card: ${JSON.stringify(result.card)}`);
  return result.errors;
}

const shared = {
  id: "ml.trees.leaf-mean",
  version: 1,
  tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
  sourceIds: [],
  lesson: "lesson-04",
};

describe("cardFromForm", () => {
  it.each<{ type: string; form: TCardForm; card: TCard }>([
    {
      type: "qa",
      form: form({ en: { question: " What is the leaf mean? ", answer: " The mean. " } }),
      card: {
        ...shared,
        type: "qa",
        en: { question: "What is the leaf mean?", answer: "The mean." },
      },
    },
    {
      type: "cloze",
      form: form({ type: "cloze", en: { text: " A leaf predicts the {{mean}}. " } }),
      card: { ...shared, type: "cloze", en: { text: "A leaf predicts the {{mean}}." } },
    },
    {
      type: "true_false",
      form: form({ type: "true_false", en: { statement: " A leaf is a node. " }, answer: false }),
      card: {
        ...shared,
        type: "true_false",
        en: { statement: "A leaf is a node." },
        answer: false,
      },
    },
    {
      type: "formula",
      form: form({
        type: "formula",
        en: {
          name: " Vector norm ",
          wordFormula: " The root of the summed squares. ",
          readAloud: " norm of x ",
          example: " |(3, 4)| = 5 ",
        },
        both: { formula: " |x| = √(x₁² + x₂²) ", latex: " \\lVert x \\rVert " },
      }),
      card: {
        ...shared,
        type: "formula",
        en: {
          name: "Vector norm",
          wordFormula: "The root of the summed squares.",
          readAloud: "norm of x",
          example: "|(3, 4)| = 5",
        },
        formula: "|x| = √(x₁² + x₂²)",
        latex: "\\lVert x \\rVert",
      },
    },
  ])(
    "makes a valid $type Card with version 1, no sources, trimmed text and tags split at commas",
    ({ form: typed, card }) => {
      const result = made({ ...typed, domainTags: " Machine Learning, , Statistics ," });

      expect(result).toEqual(card);
      expect(ZCard.safeParse(result).success).toBe(true);
    },
  );

  it("leaves out an empty or blank Read aloud, Example and LaTeX instead of failing", () => {
    const card = made(
      form({
        type: "formula",
        en: { ...formulaTexts, readAloud: " ", example: "" },
        both: { formula: "|x|", latex: "  " },
      }),
    );

    expect(card).toMatchObject({ type: "formula", formula: "|x|" });
    expect(card.en).toEqual(formulaTexts);
    expect(card).not.toHaveProperty("latex");
  });

  it("leaves out the translations when every German field is empty or only spaces", () => {
    expect(made(form({ de: { question: "  " } }))).not.toHaveProperty("translations");
  });

  it("keeps only the filled German fields of the Card's type, trimmed", () => {
    const card = made(
      form({ de: { question: " Was ist der Blattmittelwert? ", statement: "Nein." } }),
    );

    expect(card.translations).toEqual({ de: { question: "Was ist der Blattmittelwert?" } });
  });

  it("keeps a German cloze text with a gap", () => {
    const card = made(
      form({
        type: "cloze",
        en: { text: "A leaf predicts the {{mean}}." },
        de: { text: "Ein Blatt sagt den {{Mittelwert}} voraus." },
      }),
    );

    expect(card.translations).toEqual({
      de: { text: "Ein Blatt sagt den {{Mittelwert}} voraus." },
    });
  });

  it.each<{ problem: string; form: TCardForm; errors: object }>([
    {
      problem: "an empty question",
      form: form({ en: { question: " " } }),
      errors: { "en.question": "empty" },
    },
    {
      problem: "an empty answer",
      form: form({ en: { answer: "" } }),
      errors: { "en.answer": "empty" },
    },
    {
      problem: "an empty statement",
      form: form({ type: "true_false", en: { statement: "" } }),
      errors: { "en.statement": "empty" },
    },
    {
      problem: "an empty cloze text",
      form: form({ type: "cloze", en: { text: "" } }),
      errors: { "en.text": "empty" },
    },
    {
      problem: "a cloze without a gap",
      form: form({ type: "cloze", en: { text: "A leaf predicts the mean." } }),
      errors: { "en.text": "noGap" },
    },
    {
      problem: "a German cloze without a gap",
      form: form({
        type: "cloze",
        en: { text: "A leaf predicts the {{mean}}." },
        de: { text: "Ein Blatt sagt den Mittelwert voraus." },
      }),
      errors: { "de.text": "noGap" },
    },
    {
      problem: "an empty formula name",
      form: form({ type: "formula", en: { ...formulaTexts, name: " " }, both: { formula: "|x|" } }),
      errors: { "en.name": "empty" },
    },
    {
      problem: "an empty word formula",
      form: form({
        type: "formula",
        en: { ...formulaTexts, wordFormula: "" },
        both: { formula: "|x|" },
      }),
      errors: { "en.wordFormula": "empty" },
    },
    {
      problem: "an empty formula",
      form: form({ type: "formula", en: formulaTexts, both: { formula: " " } }),
      errors: { formula: "empty" },
    },
    {
      problem: "no domain tag",
      form: form({ domainTags: " , " }),
      errors: { "tags.domain": "empty" },
    },
    { problem: "no topic tag", form: form({ topicTags: "" }), errors: { "tags.topic": "empty" } },
    { problem: "an empty lesson", form: form({ lesson: " " }), errors: { lesson: "empty" } },
    { problem: "an empty ID", form: form({ id: "" }), errors: { id: "empty" } },
    {
      problem: "an ID that is not lowercase words",
      form: form({ id: "Bad ID" }),
      errors: { id: "idFormat" },
    },
  ])("rejects $problem with its field's error", ({ form: wrong, errors: expected }) => {
    expect(errors(wrong)).toEqual(expected);
  });

  it("gives every wrong field its error at once", () => {
    expect(errors(formFromCard())).toEqual({
      id: "empty",
      lesson: "empty",
      "tags.domain": "empty",
      "tags.topic": "empty",
      "en.question": "empty",
      "en.answer": "empty",
    });
  });

  it("checks only the fields of the picked type", () => {
    const card = made(
      form({
        type: "true_false",
        en: { question: "", answer: "", text: "No gap", statement: "A leaf is a node." },
      }),
    );

    expect(card.type).toBe("true_false");
  });

  it("rejects an ID another Card has", () => {
    expect(errors(form(), { takenIds: ["ml.trees.depth", "ml.trees.leaf-mean"] })).toEqual({
      id: "idTaken",
    });
  });

  it("trims the ID, and checks the trimmed ID against the taken ones", () => {
    expect(made(form({ id: " ml.trees.depth " })).id).toBe("ml.trees.depth");
    expect(errors(form({ id: " ml.trees.depth " }), { takenIds: ["ml.trees.depth"] })).toEqual({
      id: "idTaken",
    });
  });

  describe("with the Card being edited", () => {
    // Stored Cards went through the schema, as an upload does.
    const stored = ZCard.parse({
      ...qa("ml.trees.leaf-mean", 3),
      sourceIds: ["lesson-04.md"],
    }) as TEditableCard;
    const context = { takenIds: ["ml.trees.depth", "ml.trees.leaf-mean"], editing: stored };

    it("keeps the version when nothing changed, and its own ID is not taken", () => {
      expect(made(formFromCard(stored), context)).toEqual(stored);
    });

    it("raises the version by one when the content changed, and keeps the sources", () => {
      const unchanged = formFromCard(stored);
      const changed = { ...unchanged, en: { ...unchanged.en, answer: "Another answer." } };

      expect(made(changed, context)).toEqual({
        ...stored,
        version: 4,
        en: { ...stored.en, answer: "Another answer." },
      });
    });

    it("raises the version when the type changed", () => {
      const unchanged = formFromCard(stored);
      const changed = {
        ...unchanged,
        type: "true_false" as const,
        en: { ...unchanged.en, statement: "A leaf is a node." },
      };

      const card = made(changed, context);

      expect(card).toMatchObject({ type: "true_false", version: 4, sourceIds: ["lesson-04.md"] });
    });
  });
});

describe("formFromCard", () => {
  it("with no Card, is an empty qa form", () => {
    expect(formFromCard()).toMatchObject({
      type: "qa",
      id: "",
      lesson: "",
      domainTags: "",
      topicTags: "",
      en: noTexts,
      de: noTexts,
      both: noBoth,
    });
  });

  it("holds a Card's texts, German texts, tags joined by commas, lesson and ID", () => {
    const card = german(
      {
        ...qa("ml.trees.leaf-mean", 2),
        tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
      },
      { question: "Was ist der Blattmittelwert?" },
    );

    expect(formFromCard(card)).toEqual({
      type: "qa",
      id: "ml.trees.leaf-mean",
      lesson: "lesson-04",
      domainTags: "Machine Learning, Statistics",
      topicTags: "Decision Tree",
      en: { ...noTexts, question: "What is ml.trees.leaf-mean?", answer: "An answer." },
      de: { ...noTexts, question: "Was ist der Blattmittelwert?" },
      both: noBoth,
      answer: true,
    });
  });

  it.each([
    ZCard.parse(german(cloze("c", 1), { text: "c hat eine {{Lücke}}." })) as TEditableCard,
    ZCard.parse(german(trueFalse("t", 1, false), { statement: "t ist wahr." })) as TEditableCard,
    ZCard.parse(fullFormula("f", 1)) as TEditableCard,
  ])("gives back the same $type Card through cardFromForm", (card) => {
    expect(made(formFromCard(card), { takenIds: [card.id], editing: card })).toEqual(card);
  });
});

describe("isEditable", () => {
  it.each([qa("a", 1), cloze("a", 1), trueFalse("a", 1), formula("a", 1)])(
    "a $type Card is editable",
    (card) => {
      expect(isEditable(card)).toBe(true);
    },
  );

  it.each([multipleChoice("a", 1), numeric("a", 1)])("a $type Card is not editable yet", (card) => {
    expect(isEditable(card)).toBe(false);
  });
});

describe("suggestId", () => {
  it.each([
    { text: "What is the leaf mean?", id: "what-is-the-leaf-mean" },
    { text: "Is it true, or (really) false?!", id: "is-it-true-or-really" },
    { text: "How does a decision tree pick its split?", id: "how-does-a-decision-tree" },
    { text: "Über naïve Café", id: "uber-naive-cafe" },
    { text: "A leaf predicts the {{mean}}.", id: "a-leaf-predicts-the-mean" },
    { text: "Top 10 trees", id: "top-10-trees" },
    { text: "  ?! … ", id: "" },
    { text: "", id: "" },
  ])("suggests $id from $text", ({ text, id }) => {
    expect(suggestId(text)).toBe(id);
  });

  it("suggests an ID the Card schema accepts", () => {
    const id = suggestId("Über naïve Café, {{really}}?");

    expect(ZCard.safeParse({ ...qa("x", 1), id }).success).toBe(true);
  });
});
