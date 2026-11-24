import { ZCard } from "@flashcards/cards";
import { describe, expect, it } from "vitest";
import { cardFromDraft, draftFromCard, emptyDraft, suggestId, type TDraft } from "./editor.helper";
import { cloze, german, qa, trueFalse } from "./test/cards.fixtures";

const filled: TDraft = {
  ...emptyDraft,
  id: "ml.trees.depth",
  lesson: "lesson-04",
  domainTags: "Machine Learning, ",
  topicTags: " Decision Tree , Variance",
};

describe("suggestId", () => {
  it.each([
    ["What does a regression leaf predict?", "what-does-a-regression-leaf"],
    ["A deeper tree has {{higher}} variance.", "a-deeper-tree-has-higher"],
    ["Größere Bäume überanpassen", "grossere-baume-uberanpassen"],
    ["  ", ""],
  ])("%s gives %s", (text, id) => {
    expect(suggestId(text)).toBe(id);
  });
});

describe("cardFromDraft", () => {
  it.each<{ draft: TDraft; card: Record<string, unknown> }>([
    {
      draft: { ...filled, type: "qa", question: " Why? ", answer: "Because." },
      card: { type: "qa", en: { question: "Why?", answer: "Because." } },
    },
    {
      draft: { ...filled, type: "cloze", text: "A {{gap}}.", textDe: "Eine {{Lücke}}." },
      card: {
        type: "cloze",
        en: { text: "A {{gap}}." },
        translations: { de: { text: "Eine {{Lücke}}." } },
      },
    },
    {
      draft: { ...filled, type: "true_false", statement: "Trees split.", truth: false },
      card: { type: "true_false", en: { statement: "Trees split." }, answer: false },
    },
  ])("makes a valid version 1 $draft.type Card", ({ draft, card }) => {
    const result = cardFromDraft(draft, ["other"]);

    expect(result).toEqual({
      card: {
        id: "ml.trees.depth",
        version: 1,
        tags: { domain: ["Machine Learning"], topic: ["Decision Tree", "Variance"] },
        sourceIds: [],
        lesson: "lesson-04",
        ...card,
      },
    });
    expect("card" in result && ZCard.safeParse(result.card).success).toBe(true);
  });

  it("keeps only the German fields that are filled in", () => {
    const result = cardFromDraft(
      { ...filled, question: "Why?", answer: "Because.", answerDe: " Darum. " },
      [],
    );

    expect("card" in result && result.card.translations).toEqual({ de: { answer: "Darum." } });
  });

  it.each<{ name: string; draft: TDraft; errors: Record<string, string> }>([
    {
      name: "empty fields",
      draft: { ...emptyDraft, domainTags: " , " },
      errors: {
        id: "required",
        lesson: "required",
        domainTags: "required",
        topicTags: "required",
        question: "required",
        answer: "required",
      },
    },
    {
      name: "a cloze without a gap, in English and German",
      draft: { ...filled, type: "cloze", text: "No gap.", textDe: "Keine {{}} Lücke." },
      errors: { text: "needsGap", textDe: "needsGap" },
    },
    {
      name: "an empty cloze text",
      draft: { ...filled, type: "cloze", text: " " },
      errors: { text: "required" },
    },
    {
      name: "a duplicate ID",
      draft: { ...filled, id: "taken", statement: "True.", type: "true_false" },
      errors: { id: "duplicateId" },
    },
    {
      name: "an ID with capitals",
      draft: { ...filled, id: "Trees", statement: "True.", type: "true_false" },
      errors: { id: "idFormat" },
    },
  ])("gives the field errors of $name", ({ draft, errors }) => {
    expect(cardFromDraft(draft, ["taken"])).toEqual({ errors });
  });

  it("raises the version of an edited Card, keeping its ID and source IDs", () => {
    const stored = { ...qa("a", 3), sourceIds: ["s1"] };
    const draft = { ...draftFromCard(stored), id: "ignored", answer: "Changed." };

    const result = cardFromDraft(draft, ["a"], stored);

    expect(result).toEqual({
      card: { ...stored, version: 4, en: { ...stored.en, answer: "Changed." } },
    });
  });

  it.each([
    german(qa("a", 2), { question: "Was ist a?" }),
    german(cloze("a", 2), { text: "a hat eine {{Lücke}}." }),
    trueFalse("a", 2, false),
  ])("keeps the version of a $type Card saved unchanged", (stored) => {
    expect(cardFromDraft(draftFromCard(stored), ["a"], stored)).toEqual({ card: stored });
  });
});
