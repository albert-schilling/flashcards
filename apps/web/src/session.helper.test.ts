import { describe, expect, it } from "vitest";
import { allTags, canAnswer, pickCards } from "./session.helper";
import { multipleChoice, qa, tagged, trueFalse } from "./test/cards";

const ids = (cards: { id: string }[]) => cards.map((card) => card.id).sort();

describe("canAnswer", () => {
  it("canAnswer takes qa Cards only", () => {
    expect(canAnswer(qa("a", 1))).toBe(true);
    expect(canAnswer(trueFalse("b", 1))).toBe(false);
    expect(canAnswer(multipleChoice("c", 1))).toBe(false);
  });
});

describe("allTags", () => {
  it("lists each tag once, sorted", () => {
    const cards = [
      tagged(qa("a", 1), ["Statistics"], ["Regression", "Bias"]),
      tagged(qa("b", 1), ["Machine Learning"], ["Regression"]),
    ];

    expect(allTags(cards)).toEqual(["Bias", "Machine Learning", "Regression", "Statistics"]);
  });
});

describe("pickCards", () => {
  const cards = ["a", "b", "c", "d", "e"].map((id) => qa(id, 1));

  it("picks `size` different Cards from more, and all of fewer", () => {
    const picked = pickCards(cards, 3);

    expect(new Set(ids(picked)).size).toBe(3);
    expect(ids(cards)).toEqual(expect.arrayContaining(ids(picked)));
    expect(ids(pickCards(cards, 10))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("keeps only Cards with the tag as domain or topic tag", () => {
    const mixed = [
      tagged(qa("domain", 1), ["Regression"], ["Bias"]),
      tagged(qa("topic", 1), ["Statistics"], ["Regression"]),
      tagged(qa("neither", 1), ["Statistics"], ["Bias"]),
    ];

    expect(ids(pickCards(mixed, 10, "Regression"))).toEqual(["domain", "topic"]);
  });
});
