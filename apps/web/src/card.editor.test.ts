import { ZCard, type TCard } from "@flashcards/cards";
import { describe, expect, it } from "vitest";
import { cardOf, draftOf, emptyDraft, isEditable, suggestId, type TCardDraft } from "./card.editor";
import {
  cloze,
  formula,
  german,
  multipleChoice,
  numeric,
  qa,
  trueFalse,
} from "./test/cards.fixtures";

/** A filled-in draft of this type: every field the type needs, no German. */
function draft(changes: Partial<TCardDraft> = {}): TCardDraft {
  return {
    ...emptyDraft(),
    id: "ml.entropy",
    lesson: "lesson-04",
    domainTags: "Machine Learning",
    topicTags: "Decision Tree",
    question: "What is entropy?",
    answer: "A measure of disorder.",
    text: "Entropy measures {{disorder}}.",
    statement: "Entropy is never negative.",
    ...changes,
  };
}

function built(input: TCardDraft, takenIds: string[] = [], edited?: TCard): TCard {
  const result = cardOf(input, takenIds, edited);
  if (!result.ok) throw new Error(`expected a Card, got ${JSON.stringify(result.errors)}`);
  return result.card;
}

function errorsOf(input: TCardDraft, takenIds: string[] = [], edited?: TCard) {
  const result = cardOf(input, takenIds, edited);
  if (result.ok) throw new Error("expected errors, got a Card");
  return result.errors;
}

describe("cardOf, a new Card", () => {
  it("makes a valid qa Card at version 1 with trimmed text and split tags", () => {
    const card = built(
      draft({
        question: "  What is entropy? ",
        domainTags: " Machine Learning , Statistics,, ",
        topicTags: "Decision Tree",
      }),
    );

    expect(ZCard.parse(card)).toEqual(card);
    expect(card).toEqual({
      id: "ml.entropy",
      version: 1,
      tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      type: "qa",
      en: { question: "What is entropy?", answer: "A measure of disorder." },
    });
  });

  it("takes the ID and the lesson without the spaces around them", () => {
    expect(built(draft({ id: " ml.entropy ", lesson: " lesson-04 " }))).toMatchObject({
      id: "ml.entropy",
      lesson: "lesson-04",
    });
  });

  it("makes a valid cloze Card from the text alone", () => {
    const card = built(draft({ type: "cloze" }));

    expect(ZCard.parse(card)).toEqual(card);
    expect(card).toMatchObject({ type: "cloze", en: { text: "Entropy measures {{disorder}}." } });
    expect(card).not.toHaveProperty("answer");
  });

  it("makes a valid true_false Card with its answer", () => {
    const card = built(draft({ type: "true_false", isTrue: false }));

    expect(ZCard.parse(card)).toEqual(card);
    expect(card).toMatchObject({
      type: "true_false",
      en: { statement: "Entropy is never negative." },
      answer: false,
    });
  });

  it("adds only the German fields that are filled in, and no translations when none is", () => {
    const withGerman = built(draft({ germanQuestion: " Was ist Entropie? ", germanAnswer: "" }));
    const without = built(draft({ germanQuestion: "  " }));

    expect(withGerman).toMatchObject({ translations: { de: { question: "Was ist Entropie?" } } });
    expect(withGerman.translations?.de).not.toHaveProperty("answer");
    expect(without).not.toHaveProperty("translations");
  });

  it("ignores the fields of the other types", () => {
    const card = built(draft({ type: "true_false", germanText: "Ohne Lücke" }));

    expect(card).not.toHaveProperty("translations");
  });
});

describe("cardOf, an edited Card", () => {
  it("raises the version by one and keeps the Card's sourceIds", () => {
    const old: TCard = { ...qa("ml.entropy", 3), sourceIds: ["source-1"] };

    const card = built(draft({ answer: "Disorder." }), ["ml.entropy"], old);

    expect(card).toMatchObject({ id: "ml.entropy", version: 4, sourceIds: ["source-1"] });
    expect(card).toMatchObject({ en: { answer: "Disorder." } });
  });

  it("round-trips every editable type through its draft, with only the version raised", () => {
    const cards: TCard[] = [
      german(qa("a", 2), { question: "Was ist a?", answer: "Eine Antwort." }),
      german(cloze("b", 1), { text: "b hat eine {{Lücke}}." }),
      german(trueFalse("c", 5, false), { statement: "c ist wahr." }),
    ];
    for (const old of cards) {
      if (!isEditable(old)) throw new Error(`${old.type} should be editable`);

      expect(built(draftOf(old), ["a", "b", "c"], old)).toEqual({
        ...old,
        version: old.version + 1,
      });
    }
  });
});

describe("cardOf, errors", () => {
  it("names every empty required field of a qa Card", () => {
    expect(errorsOf(emptyDraft())).toEqual({
      question: "required",
      answer: "required",
      id: "required",
      lesson: "required",
      domainTags: "required",
      topicTags: "required",
    });
  });

  it("treats blank text and tags of only commas as empty", () => {
    expect(errorsOf(draft({ statement: " ", type: "true_false", topicTags: " , " }))).toEqual({
      statement: "required",
      topicTags: "required",
    });
  });

  it("asks for a gap in a cloze text, English or German", () => {
    expect(errorsOf(draft({ type: "cloze", text: "No gap here." }))).toEqual({ text: "noGap" });
    expect(errorsOf(draft({ type: "cloze", text: "" }))).toEqual({ text: "required" });
    expect(errorsOf(draft({ type: "cloze", germanText: "Keine Lücke." }))).toEqual({
      germanText: "noGap",
    });
  });

  it("rejects an ID that isn't lowercase words joined by dots or hyphens", () => {
    for (const id of ["ML.Entropy", "ml entropy", "ml..entropy", "-ml"]) {
      expect(errorsOf(draft({ id }))).toEqual({ id: "idFormat" });
    }
  });

  it("rejects the ID of another stored Card, but not the edited Card's own", () => {
    expect(errorsOf(draft(), ["ml.entropy"])).toEqual({ id: "idTaken" });
    expect(built(draft(), ["ml.entropy"], qa("ml.entropy", 1)).id).toBe("ml.entropy");
  });
});

describe("draftOf", () => {
  it("fills the fields of a Card, its tags joined by commas and its German texts", () => {
    const card: TCard = {
      ...german(qa("ml.entropy", 2), { question: "Was ist Entropie?", answer: "Unordnung." }),
      tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
    };
    if (!isEditable(card)) throw new Error("qa should be editable");

    expect(draftOf(card)).toMatchObject({
      type: "qa",
      id: "ml.entropy",
      lesson: "lesson-04",
      domainTags: "Machine Learning, Statistics",
      topicTags: "Decision Tree",
      question: card.en.question,
      answer: card.en.answer,
      germanQuestion: card.translations?.de.question,
      germanAnswer: card.translations?.de.answer,
    });
  });
});

describe("isEditable", () => {
  it("is true for qa, cloze and true_false, false for the other types", () => {
    expect([qa, cloze, trueFalse].map((make) => isEditable(make("a", 1)))).toEqual([
      true,
      true,
      true,
    ]);
    expect([formula, multipleChoice, numeric].map((make) => isEditable(make("a", 1)))).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("suggestId", () => {
  it("joins the lowercase words of the text with hyphens", () => {
    expect(suggestId("What is a decision tree?")).toBe("what-is-a-decision-tree");
  });

  it("drops accents, gap braces and anything but letters and digits", () => {
    expect(suggestId("Größe & {{Gini}}-Index: 2 Werte")).toBe("grosse-gini-index-2-werte");
  });

  it("keeps the first six words", () => {
    expect(suggestId("one two three four five six seven")).toBe("one-two-three-four-five-six");
  });

  it("is empty for a text without letters or digits", () => {
    expect(suggestId(" ?! ")).toBe("");
  });
});
