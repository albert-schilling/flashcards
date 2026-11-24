import { ZCard, type TCard } from "@flashcards/cards";
import { describe, expect, it } from "vitest";
import { buildCard, fieldsFromCard, suggestId, type TEditorFields } from "./card.editor";
import { cloze, german, qa, tagged, trueFalse } from "./test/cards.fixtures";

/** Empty editor fields with a lesson and one tag of each kind, changed by `changes`. */
function fields(changes: Partial<TEditorFields>): TEditorFields {
  return {
    ...fieldsFromCard(),
    lesson: "lesson-04",
    domain: "Machine Learning",
    topic: "Decision Tree",
    ...changes,
  };
}

/** The Card `buildCard` makes from these fields, failing the test if it gives errors. */
function built(result: ReturnType<typeof buildCard>): TCard {
  if (!("card" in result)) throw new Error(`Expected a Card, got ${JSON.stringify(result)}`);
  return result.card;
}

describe("a new Card", () => {
  it("starts from empty fields with the qa type", () => {
    expect(fieldsFromCard()).toMatchObject({
      type: "qa",
      id: "",
      lesson: "",
      domain: "",
      topic: "",
      question: "",
      answer: "",
      text: "",
      statement: "",
      deQuestion: "",
      deAnswer: "",
      deText: "",
      deStatement: "",
    });
  });

  it("builds a valid qa Card at version 1 with no sources and no translations", () => {
    const card = built(
      buildCard(
        fields({
          id: "what-is-a-leaf",
          question: "What is a leaf?",
          answer: "An end node.",
        }),
        [],
      ),
    );

    expect(card).toStrictEqual({
      id: "what-is-a-leaf",
      version: 1,
      tags: { domain: ["Machine Learning"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      type: "qa",
      en: { question: "What is a leaf?", answer: "An end node." },
    });
    expect(ZCard.safeParse(card).success).toBe(true);
  });

  it("builds a valid cloze Card from its text", () => {
    const card = built(
      buildCard(fields({ type: "cloze", id: "leaf-mean", text: "A {{leaf}} holds the mean." }), []),
    );

    expect(card).toStrictEqual({
      id: "leaf-mean",
      version: 1,
      tags: { domain: ["Machine Learning"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      type: "cloze",
      en: { text: "A {{leaf}} holds the mean." },
    });
    expect(ZCard.safeParse(card).success).toBe(true);
  });

  it.each([
    { truth: "true" as const, answer: true },
    { truth: "false" as const, answer: false },
  ])("builds a valid true_false Card whose answer is $answer", ({ truth, answer }) => {
    const card = built(
      buildCard(
        fields({ type: "true_false", id: "trees-overfit", statement: "Trees overfit.", truth }),
        [],
      ),
    );

    expect(card).toStrictEqual({
      id: "trees-overfit",
      version: 1,
      tags: { domain: ["Machine Learning"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      type: "true_false",
      en: { statement: "Trees overfit." },
      answer,
    });
    expect(ZCard.safeParse(card).success).toBe(true);
  });

  it("splits the tags at commas, trims them and drops empty ones", () => {
    const card = built(
      buildCard(
        fields({
          id: "q",
          question: "Q?",
          answer: "A.",
          domain: " Machine Learning ,Statistics, ",
          topic: "Decision Tree,  ,Leaf",
        }),
        [],
      ),
    );

    expect(card.tags).toEqual({
      domain: ["Machine Learning", "Statistics"],
      topic: ["Decision Tree", "Leaf"],
    });
  });

  it.each([
    {
      type: "qa" as const,
      english: { question: "What is a leaf?", answer: "An end node." },
      deFields: { deQuestion: "Was ist ein Blatt?", deAnswer: "Ein Endknoten." },
      de: { question: "Was ist ein Blatt?", answer: "Ein Endknoten." },
    },
    {
      type: "qa" as const,
      english: { question: "What is a leaf?", answer: "An end node." },
      deFields: { deQuestion: "Was ist ein Blatt?" },
      de: { question: "Was ist ein Blatt?" },
    },
    {
      type: "cloze" as const,
      english: { text: "A {{leaf}} holds the mean." },
      deFields: { deText: "Ein {{Blatt}} hält den Mittelwert." },
      de: { text: "Ein {{Blatt}} hält den Mittelwert." },
    },
    {
      type: "true_false" as const,
      english: { statement: "Trees overfit." },
      deFields: { deStatement: "Bäume passen sich zu sehr an." },
      de: { statement: "Bäume passen sich zu sehr an." },
    },
  ])(
    "keeps the filled German fields of a $type Card and leaves out the empty ones",
    ({ type, english, deFields, de }) => {
      const card = built(buildCard(fields({ type, id: "c", ...english, ...deFields }), []));

      expect(card.translations).toStrictEqual({ de });
      expect(ZCard.safeParse(card).success).toBe(true);
    },
  );

  it("trims the ID, lesson and texts, and leaves out a German field of only spaces", () => {
    const card = built(
      buildCard(
        fields({
          id: " q ",
          lesson: " lesson-04 ",
          question: " Q? ",
          answer: " A. ",
          deAnswer: "  ",
        }),
        [],
      ),
    );

    expect(card).toMatchObject({
      id: "q",
      lesson: "lesson-04",
      en: { question: "Q?", answer: "A." },
    });
    expect("translations" in card).toBe(false);
  });

  it("leaves out the translations when every German field is empty", () => {
    const card = built(buildCard(fields({ id: "c", question: "Q?", answer: "A." }), []));

    expect("translations" in card).toBe(false);
  });
});

describe("field errors", () => {
  it("names every empty field of a qa Card as required, and no field of another type", () => {
    const result = buildCard({ ...fieldsFromCard(), type: "qa" }, []);

    expect(result).toEqual({
      errors: {
        id: "required",
        lesson: "required",
        domain: "required",
        topic: "required",
        question: "required",
        answer: "required",
      },
    });
  });

  it("names the empty text of a cloze Card as required", () => {
    expect(buildCard(fields({ type: "cloze", id: "c", text: "" }), [])).toEqual({
      errors: { text: "required" },
    });
  });

  it("names the empty statement of a true_false Card as required", () => {
    expect(buildCard(fields({ type: "true_false", id: "c", statement: "" }), [])).toEqual({
      errors: { statement: "required" },
    });
  });

  it("names a tag list of only commas and spaces as required", () => {
    const result = buildCard(
      fields({ id: "c", question: "Q?", answer: "A.", domain: " , ", topic: "," }),
      [],
    );

    expect(result).toEqual({ errors: { domain: "required", topic: "required" } });
  });

  it("names fields of only spaces as required", () => {
    expect(buildCard(fields({ id: "  ", lesson: " ", question: "  ", answer: "A." }), [])).toEqual({
      errors: { id: "required", lesson: "required", question: "required" },
    });
  });

  it.each(["What is a leaf", "leaf_mean", "Leaf", "leaf--mean", "-leaf"])(
    "names the ID %j as not in the ID format",
    (id) => {
      expect(buildCard(fields({ id, question: "Q?", answer: "A." }), [])).toEqual({
        errors: { id: "format" },
      });
    },
  );

  it("names a cloze text without a {{gap}} as missing its gap", () => {
    expect(
      buildCard(fields({ type: "cloze", id: "c", text: "A leaf holds the mean." }), []),
    ).toEqual({ errors: { text: "gap" } });
  });

  it("names a German cloze text without a {{gap}} as missing its gap", () => {
    expect(
      buildCard(
        fields({
          type: "cloze",
          id: "c",
          text: "A {{leaf}} holds the mean.",
          deText: "Ein Blatt hält den Mittelwert.",
        }),
        [],
      ),
    ).toEqual({ errors: { deText: "gap" } });
  });

  it("names the ID of a stored Card as a duplicate on create", () => {
    const stored = [qa("what-is-a-leaf", 1)];

    const result = buildCard(
      fields({ id: "what-is-a-leaf", question: "What is a leaf?", answer: "An end node." }),
      stored,
    );

    expect(result).toEqual({ errors: { id: "duplicate" } });
  });
});

describe("an edited Card", () => {
  // Stored Cards went through ZCard on upload, so their keys have the schema's order.
  const stored = ZCard.parse({
    ...german(qa("a", 3), { question: "Was ist a?" }),
    sourceIds: ["source-1"],
  });

  it.each<[string, TCard]>([
    ["qa", tagged(qa("a", 3), ["Machine Learning", "Statistics"], ["Decision Tree"])],
    ["German qa", german(qa("a", 3), { question: "Was ist a?", answer: "Eine Antwort." })],
    ["cloze", cloze("a", 2)],
    ["German cloze", german(cloze("a", 2), { text: "a hat eine {{Lücke}}." })],
    ["true_false", trueFalse("a", 4, false)],
    ["German true_false", german(trueFalse("a", 4), { statement: "a ist wahr." })],
    ["with sources", { ...qa("a", 2), sourceIds: ["source-1", "source-2"] }],
  ])("a %s Card saved unchanged keeps its content and version", (_, raw) => {
    const card = ZCard.parse(raw);
    const result = buildCard(fieldsFromCard(card), [card], card);

    expect(result).toEqual({ card });
  });

  it("opens with the Card's fields, tags joined by commas", () => {
    const card = german(
      tagged(qa("a", 3), ["Machine Learning", "Statistics"], ["Decision Tree", "Leaf"]),
      { question: "Was ist a?" },
    );

    expect(fieldsFromCard(card)).toMatchObject({
      type: "qa",
      id: "a",
      lesson: "lesson-04",
      domain: "Machine Learning, Statistics",
      topic: "Decision Tree, Leaf",
      question: "What is a?",
      answer: "An answer.",
      deQuestion: "Was ist a?",
      deAnswer: "",
    });
  });

  it.each([
    { card: cloze("a", 1, "A {{leaf}}."), shown: { type: "cloze", text: "A {{leaf}}." } },
    {
      card: trueFalse("a", 1, false),
      shown: { type: "true_false", statement: "a is true.", truth: "false" },
    },
    { card: trueFalse("a", 1, true), shown: { type: "true_false", truth: "true" } },
  ])("opens a $card.type Card with its own fields", ({ card, shown }) => {
    expect(fieldsFromCard(card)).toMatchObject(shown);
  });

  it("raises the version by 1 when the content changed, and keeps its sources", () => {
    const result = buildCard(
      { ...fieldsFromCard(stored), answer: "A new answer." },
      [stored],
      stored,
    );

    expect(result).toEqual({
      card: { ...stored, version: 4, en: { ...stored.en, answer: "A new answer." } },
    });
  });

  it("raises the version when only a German field changed", () => {
    const result = buildCard({ ...fieldsFromCard(stored), deAnswer: "Neu." }, [stored], stored);

    expect(built(result).version).toBe(4);
    expect(built(result).translations).toEqual({ de: { question: "Was ist a?", answer: "Neu." } });
  });

  it("does not name its own ID as a duplicate", () => {
    const result = buildCard(
      { ...fieldsFromCard(stored), answer: "New." },
      [qa("b", 1), stored],
      stored,
    );

    expect(built(result).id).toBe("a");
  });

  it("still shows field errors", () => {
    expect(buildCard({ ...fieldsFromCard(stored), question: "" }, [stored], stored)).toEqual({
      errors: { question: "required" },
    });
  });
});

describe("suggestId", () => {
  const idFormat = /^[a-z0-9]+([.-][a-z0-9]+)*$/;

  it.each([
    ["What is a leaf?", "what-is-a-leaf"],
    ["  Hello,   World!! ", "hello-world"],
    ["Café naïve résumé", "cafe-naive-resume"],
    ["A {{leaf}} holds the mean.", "a-leaf-holds-the-mean"],
    ["one two three four five six seven", "one-two-three-four-five"],
    ["Top 10 trees", "top-10-trees"],
  ])("suggests %j as %j", (text, id) => {
    expect(suggestId(text)).toBe(id);
    expect(suggestId(text)).toMatch(idFormat);
  });

  it.each(["", "   ", "?!", "{{ }}", "— … —"])(
    "suggests nothing for %j, which has no letters",
    (text) => {
      expect(suggestId(text)).toBe("");
    },
  );
});
