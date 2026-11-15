import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cardSchema, deckSchema } from "../index.js";

const shared = {
  version: 1,
  tags: { domain: ["Machine Learning"], topic: ["Decision Tree"] },
  sourceIds: [],
  lesson: "lesson-04",
};

const qa = {
  ...shared,
  id: "ml.trees.leaf-mean",
  type: "qa",
  en: { question: "What does a regression leaf predict?", answer: "The mean of its samples." },
  translations: {
    de: {
      question: "Was sagt ein Regressionsblatt vorher?",
      answer: "Den Mittelwert seiner Stichproben.",
    },
  },
};

const multipleChoice = {
  ...shared,
  id: "ml.trees.split-criterion",
  type: "multiple_choice",
  en: {
    question: "Which criterion does a regression tree split on?",
    options: ["Gini impurity", "Mean squared error"],
    explanation: "Regression trees minimise the squared error in each leaf.",
  },
  answerIndex: 1,
  translations: {
    de: {
      question: "Nach welchem Kriterium teilt ein Regressionsbaum?",
      options: ["Gini-Unreinheit", "Mittlerer quadratischer Fehler"],
      explanation: "Regressionsbäume minimieren den quadratischen Fehler in jedem Blatt.",
    },
  },
};

const formula = {
  ...shared,
  id: "math.vectors.norm",
  type: "formula",
  en: { name: "Vector norm", wordFormula: "The square root of a dot a." },
  formula: "‖a‖ = √(a · a)",
  translations: { de: { name: "Vektornorm", wordFormula: "Die Wurzel aus a mal a." } },
};

const cloze = {
  ...shared,
  id: "ml.trees.depth",
  type: "cloze",
  en: { text: "A deeper tree has {{higher}} variance." },
  translations: { de: { text: "Ein tieferer Baum hat {{höhere}} Varianz." } },
};

function issuePaths(result: { error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path) ?? [];
}

describe("cardSchema", () => {
  it("accepts German with fields missing", () => {
    const card = { ...multipleChoice, translations: { de: { question: "Welches Kriterium?" } } };

    expect(cardSchema.safeParse(card).success).toBe(true);
  });

  it.each([
    ["an unknown type", { ...qa, type: "essay" }, ["type"]],
    ["no lesson", { ...qa, lesson: undefined }, ["lesson"]],
    ["an ID with spaces", { ...qa, id: "ml.trees.leaf mean" }, ["id"]],
    ["an ID with capitals", { ...qa, id: "ml.trees.Leaf-Mean" }, ["id"]],
    ["version 0", { ...qa, version: 0 }, ["version"]],
    ["version 1.5", { ...qa, version: 1.5 }, ["version"]],
    ["empty English text", { ...qa, en: { ...qa.en, question: "" } }, ["en", "question"]],
    ["the unknown key translation", { ...qa, translation: qa.translations }, []],
    [
      "a language other than German",
      { ...qa, translations: { ...qa.translations, fr: { question: "Que prédit une feuille ?" } } },
      ["translations"],
    ],
    [
      "a formula without wordFormula",
      { ...formula, en: { ...formula.en, wordFormula: undefined } },
      ["en", "wordFormula"],
    ],
    [
      "a cloze without a gap",
      { ...cloze, en: { text: "A deeper tree has higher variance." } },
      ["en", "text"],
    ],
    [
      "a cloze with an empty gap",
      { ...cloze, en: { text: "A deeper tree has {{}} variance." } },
      ["en", "text"],
    ],
    ["answerIndex past the last option", { ...multipleChoice, answerIndex: 2 }, ["answerIndex"]],
    [
      "German options of a different length",
      {
        ...multipleChoice,
        translations: { de: { ...multipleChoice.translations.de, options: ["Gini-Unreinheit"] } },
      },
      ["translations", "de", "options"],
    ],
  ])("rejects a Card with %s", (_name, card, path) => {
    const result = cardSchema.safeParse(card);

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContainEqual(path);
  });
});

describe("deckSchema", () => {
  it("the example Deck is valid and has a Card of each type", () => {
    const exampleUrl = new URL("../../example-deck.json", import.meta.url);
    const example = JSON.parse(readFileSync(exampleUrl, "utf8"));

    const deck = deckSchema.parse(example);

    expect(new Set(deck.cards.map((card) => card.type))).toEqual(
      new Set(["qa", "multiple_choice", "formula", "numeric", "cloze", "true_false"]),
    );
    expect(new URL(example.$schema, exampleUrl).href).toBe(
      new URL("../../deck.schema.json", import.meta.url).href,
    );
  });

  it("accepts a Deck with no Cards", () => {
    expect(deckSchema.safeParse({ cards: [] }).success).toBe(true);
  });

  it("rejects a Deck with two Cards of the same ID", () => {
    const result = deckSchema.safeParse({ cards: [qa, { ...cloze, id: qa.id }] });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContainEqual(["cards", 1, "id"]);
  });

  it("deck.schema.json matches the schema", async () => {
    const jsonSchema = `${JSON.stringify(z.toJSONSchema(deckSchema), null, 2)}\n`;

    await expect(jsonSchema).toMatchFileSnapshot("../../deck.schema.json");
  });
});
