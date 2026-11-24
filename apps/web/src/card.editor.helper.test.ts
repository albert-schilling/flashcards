import { ZCard, type TCard } from "@flashcards/cards";
import { describe, expect, it } from "vitest";
import {
  checkForm,
  emptyForm,
  formFromCard,
  suggestId,
  type TEditorForm,
} from "./card.editor.helper";
import { cloze, german, qa, tagged, trueFalse } from "./test/cards.fixtures";

/** A form that makes a valid qa Card; `changes` overrides fields. */
function qaForm(changes: Partial<TEditorForm> = {}): TEditorForm {
  return {
    ...emptyForm("qa"),
    id: "ml.trees.depth",
    lesson: "lesson-04",
    domain: "Machine Learning",
    topic: "Decision Tree",
    question: "What is depth?",
    answer: "The longest path.",
    ...changes,
  };
}

function clozeForm(changes: Partial<TEditorForm> = {}): TEditorForm {
  return qaForm({ type: "cloze", text: "Depth is the {{longest}} path.", ...changes });
}

function trueFalseForm(changes: Partial<TEditorForm> = {}): TEditorForm {
  return qaForm({
    type: "true_false",
    statement: "A leaf has depth 0.",
    answer: "false",
    ...changes,
  });
}

/** The errors of a form that is invalid. */
function errorsOf(form: TEditorForm, storedIds: string[] = [], old?: TCard) {
  const result = checkForm(form, storedIds, old);
  if (!("errors" in result)) throw new Error("The form should be invalid.");
  return result.errors;
}

/** The Card of a form that is valid. */
function cardOf(form: TEditorForm, storedIds: string[] = [], old?: TCard) {
  const result = checkForm(form, storedIds, old);
  if (!("card" in result)) throw new Error(`The form should be valid: ${JSON.stringify(result)}`);
  return result.card;
}

describe("checkForm, creating", () => {
  it("makes a qa Card of version 1 with no sources, and splits and trims the tags", () => {
    const card = cardOf(
      qaForm({ domain: " Machine Learning ,Statistics, ", topic: "Decision Tree" }),
    );

    expect(card).toEqual({
      id: "ml.trees.depth",
      version: 1,
      type: "qa",
      tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      en: { question: "What is depth?", answer: "The longest path." },
    });
    expect(ZCard.safeParse(card).success).toBe(true);
  });

  it("makes a cloze Card", () => {
    expect(cardOf(clozeForm()).type).toBe("cloze");
    expect(cardOf(clozeForm())).toMatchObject({ en: { text: "Depth is the {{longest}} path." } });
  });

  it.each([
    { answer: "true", expected: true },
    { answer: "false", expected: false },
  ])("makes a true_false Card with answer $answer as the boolean $expected", (c) => {
    expect(cardOf(trueFalseForm({ answer: c.answer }))).toMatchObject({
      type: "true_false",
      en: { statement: "A leaf has depth 0." },
      answer: c.expected,
    });
  });

  it("ignores the fields that don't belong to the type", () => {
    const card = cardOf(qaForm({ text: "Stray {{gap}}", statement: "Stray statement." }));

    expect(card.en).toEqual({ question: "What is depth?", answer: "The longest path." });
    expect(Object.keys(card).sort()).toEqual(
      ["en", "id", "lesson", "sourceIds", "tags", "type", "version"].sort(),
    );
  });

  it("reports every empty field of an empty form, one error per field", () => {
    const errors = errorsOf(emptyForm("qa"));

    expect(Object.keys(errors).sort()).toEqual(
      ["answer", "domain", "id", "lesson", "question", "topic"].sort(),
    );
    expect(errors.question).toBe("required");
    expect(errors.answer).toBe("required");
    expect(errors.lesson).toBe("required");
    expect(errors.domain).toBe("required");
    expect(errors.topic).toBe("required");
  });

  it("reports only the invalid fields", () => {
    expect(errorsOf(qaForm({ answer: "" }))).toEqual({ answer: "required" });
  });

  it("asks for a domain Tag and a topic Tag when the field holds only commas", () => {
    expect(errorsOf(qaForm({ domain: " , ", topic: "," }))).toEqual({
      domain: "required",
      topic: "required",
    });
  });

  it.each(["Not Valid", "has space", "trailing-", ".leading", "double--hyphen", "UPPER"])(
    "rejects the ID %j as idFormat",
    (id) => {
      expect(errorsOf(qaForm({ id }))).toEqual({ id: "idFormat" });
    },
  );

  it("rejects an ID that is stored, and accepts another", () => {
    expect(errorsOf(qaForm(), ["ml.trees.depth", "other"])).toEqual({ id: "idTaken" });
    expect(cardOf(qaForm(), ["other"]).id).toBe("ml.trees.depth");
  });

  it("reports a stored ID together with the other errors", () => {
    expect(errorsOf(qaForm({ lesson: "" }), ["ml.trees.depth"])).toEqual({
      id: "idTaken",
      lesson: "required",
    });
  });

  it("reports a malformed ID as idFormat, not idTaken, when other fields are wrong too", () => {
    expect(errorsOf(qaForm({ id: "Not Valid", lesson: "" }), ["Not Valid"])).toEqual({
      id: "idFormat",
      lesson: "required",
    });
  });

  it("asks for a gap in the cloze text", () => {
    expect(errorsOf(clozeForm({ text: "No gap here." }))).toEqual({ text: "needsGap" });
    expect(errorsOf(clozeForm({ text: "" }))).toEqual({ text: "required" });
  });

  it("treats whitespace-only text as empty, in English and in German", () => {
    expect(errorsOf(qaForm({ question: "   ", lesson: "\t" }))).toEqual({
      question: "required",
      lesson: "required",
    });
    expect(
      cardOf(qaForm({ de: { question: "  ", answer: " ", text: "", statement: "" } })),
    ).not.toHaveProperty("translations");
  });

  it("trims the ID the Learner typed", () => {
    expect(cardOf(qaForm({ id: "  ml.trees.depth " })).id).toBe("ml.trees.depth");
    expect(errorsOf(qaForm({ id: " other " }), ["other"])).toEqual({ id: "idTaken" });
  });

  it("asks for a statement in a true_false Card", () => {
    expect(errorsOf(trueFalseForm({ statement: "" }))).toEqual({ statement: "required" });
  });

  it("reports an error for each field of the type only", () => {
    // The qa fields are empty but not shown, so they are not wrong.
    expect(errorsOf(clozeForm({ text: "", question: "", answer: "" }))).toEqual({
      text: "required",
    });
  });
});

describe("checkForm, German fields", () => {
  it("leaves out the empty German fields", () => {
    const card = cardOf(
      qaForm({ de: { question: "Was ist Tiefe?", answer: "", text: "", statement: "" } }),
    );

    expect(card.translations).toEqual({ de: { question: "Was ist Tiefe?" } });
  });

  it("makes no translations when every German field is empty", () => {
    const card = cardOf(qaForm());

    expect("translations" in card).toBe(false);
  });

  it("ignores German fields that don't belong to the type", () => {
    const card = cardOf(
      qaForm({
        de: {
          question: "Was ist Tiefe?",
          answer: "Der längste Pfad.",
          text: "Stray",
          statement: "Stray",
        },
      }),
    );

    expect(card.translations).toEqual({
      de: { question: "Was ist Tiefe?", answer: "Der längste Pfad." },
    });
  });

  it("asks for a gap in a German cloze text, but not for an empty one", () => {
    const noGap = { question: "", answer: "", statement: "", text: "Ohne Lücke." };

    expect(errorsOf(clozeForm({ de: noGap }))).toEqual({ "de.text": "needsGap" });
    expect(cardOf(clozeForm({ de: { ...noGap, text: "" } })).translations).toBeUndefined();
    expect(
      cardOf(clozeForm({ de: { ...noGap, text: "Die {{Tiefe}} zählt." } })).translations,
    ).toEqual({ de: { text: "Die {{Tiefe}} zählt." } });
  });

  it("makes a German true_false statement", () => {
    const de = { question: "", answer: "", text: "", statement: "Ein Blatt hat Tiefe 0." };

    expect(cardOf(trueFalseForm({ de })).translations).toEqual({
      de: { statement: "Ein Blatt hat Tiefe 0." },
    });
  });
});

describe("formFromCard", () => {
  it("fills the fields from a qa Card, with its German fields", () => {
    const card = german(qa("ml.trees.depth", 3), { question: "Was ist Tiefe?" });

    const form = formFromCard(card);

    expect(form).toMatchObject({
      type: "qa",
      id: "ml.trees.depth",
      lesson: "lesson-04",
      question: "What is ml.trees.depth?",
      answer: "An answer.",
      de: { question: "Was ist Tiefe?", answer: "" },
    });
  });

  it("writes the tags so that they split back into the same tags", () => {
    const card = tagged(qa("a", 1), ["Machine Learning", "Statistics"], ["Decision Tree", "Bias"]);

    const form = formFromCard(card);

    expect(form.domain.split(",").map((tag) => tag.trim())).toEqual([
      "Machine Learning",
      "Statistics",
    ]);
    expect(form.topic.split(",").map((tag) => tag.trim())).toEqual(["Decision Tree", "Bias"]);
  });

  it("writes a true_false answer as true or false", () => {
    expect(formFromCard(trueFalse("a", 1, true))).toMatchObject({
      type: "true_false",
      statement: "a is true.",
      answer: "true",
    });
    expect(formFromCard(trueFalse("a", 1, false)).answer).toBe("false");
  });

  it("fills the text of a cloze Card", () => {
    expect(formFromCard(cloze("a", 1))).toMatchObject({ type: "cloze", text: "a has a {{gap}}." });
  });
});

describe("checkForm, editing", () => {
  const cards: TCard[] = [
    qa("a", 1),
    cloze("b", 2),
    trueFalse("c", 1, false),
    german(qa("d", 4), { question: "Was ist d?", answer: "Eine Antwort." }),
    german(cloze("e", 1), { text: "e hat eine {{Lücke}}." }),
    german(trueFalse("f", 2), { statement: "f ist wahr." }),
    tagged(qa("g", 1), ["Machine Learning", "Statistics"], ["Decision Tree", "Bias"]),
  ];

  it.each(cards)("gives back $id as it was when the form is as formFromCard made it", (old) => {
    // Ignoring the stored ID: editing doesn't check it against itself.
    expect(cardOf(formFromCard(old), [old.id], old)).toEqual(old);
  });

  it("raises the version by one when the content changes", () => {
    const old = qa("a", 3);

    const card = cardOf({ ...formFromCard(old), answer: "A new answer." }, [old.id], old);

    expect(card).toEqual({ ...old, version: 4, en: { ...old.en, answer: "A new answer." } });
  });

  it("raises the version when only a tag, the lesson, the true_false answer or the German text changes", () => {
    const old = german(trueFalse("a", 1, true), { statement: "a ist wahr." });
    const form = formFromCard(old);

    expect(cardOf({ ...form, topic: "Other" }, [], old).version).toBe(2);
    expect(cardOf({ ...form, lesson: "lesson-05" }, [], old).version).toBe(2);
    expect(cardOf({ ...form, answer: "false" }, [], old)).toMatchObject({
      version: 2,
      answer: false,
    });
    expect(cardOf({ ...form, de: { ...form.de, statement: "" } }, [], old)).toMatchObject({
      version: 2,
    });
    expect("translations" in cardOf({ ...form, de: { ...form.de, statement: "" } }, [], old)).toBe(
      false,
    );
  });

  it("keeps the ID and the sources, even if the form holds another ID", () => {
    const old = { ...qa("a", 1), sourceIds: ["lesson-04.md", "slides-2"] };

    const card = cardOf({ ...formFromCard(old), id: "other", answer: "Changed." }, ["other"], old);

    expect(card.id).toBe("a");
    expect(card.sourceIds).toEqual(["lesson-04.md", "slides-2"]);
  });

  it("reports the invalid fields, as when creating", () => {
    const old = qa("a", 1);

    expect(errorsOf({ ...formFromCard(old), question: "" }, [], old)).toEqual({
      question: "required",
    });
  });
});

describe("suggestId", () => {
  it.each([
    { text: "Decision Tree Leaf Mean", id: "decision-tree-leaf-mean" },
    { text: "What is a p-value?", id: "what-is-a-p-value" },
    { text: "  --Hello,   world!! ", id: "hello-world" },
    { text: "Depth is the {{Longest}} path.", id: "depth-is-the-longest-path" },
    { text: "A {{two words}} gap", id: "a-two-words-gap" },
    { text: "Layer 2 has 42 nodes", id: "layer-2-has-42-nodes" },
    { text: "42", id: "42" },
  ])("suggests $id for $text", ({ text, id }) => {
    expect(suggestId(text, [])).toBe(id);
  });

  it("suggests nothing when the text has no letter or digit", () => {
    expect(suggestId("", [])).toBe("");
    expect(suggestId(" ?! --- ", [])).toBe("");
    expect(suggestId("{{}}", [])).toBe("");
  });

  it("makes IDs that the schema accepts", () => {
    for (const text of ["What is a p-value?", "A {{gap}}.", "  x  ", "9 lives"]) {
      expect(suggestId(text, [])).toMatch(/^[a-z0-9]+([.-][a-z0-9]+)*$/);
    }
  });

  it("keeps a text of exactly 40 characters whole", () => {
    const text = "aaaaaaaa bbbbbbbb cccccccc dddddddd eeee";

    expect(suggestId(text, [])).toBe("aaaaaaaa-bbbbbbbb-cccccccc-dddddddd-eeee");
  });

  it("cuts a long text at a hyphen, at most 40 characters", () => {
    expect(suggestId("alpha beta gamma delta epsilon zeta theta iota", [])).toBe(
      "alpha-beta-gamma-delta-epsilon-zeta",
    );
    // The 40th character is the hyphen after "lazy"; the cut drops it.
    expect(suggestId("the quick brown fox jumps over the lazy dog again", [])).toBe(
      "the-quick-brown-fox-jumps-over-the-lazy",
    );
  });

  it("cuts a single long word at 40 characters", () => {
    expect(suggestId("a".repeat(60), [])).toBe("a".repeat(40));
  });

  it("adds -2, -3 while a stored ID has it", () => {
    expect(suggestId("What is depth?", ["what-is-depth"])).toBe("what-is-depth-2");
    expect(suggestId("What is depth?", ["what-is-depth", "what-is-depth-2"])).toBe(
      "what-is-depth-3",
    );
    expect(suggestId("What is depth?", ["what-is-depth-2"])).toBe("what-is-depth");
  });
});
