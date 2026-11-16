import { describe, expect, it } from "vitest";
import { allTags, pickCards, withinAllowedError } from "./session.helper";
import { qa, review, tagged } from "./test/cards.fixtures";

const ids = (cards: { id: string }[]) => cards.map((card) => card.id).sort();

describe("withinAllowedError", () => {
  it.each([
    { answer: 5, allowedError: 0.01, given: 5, right: true },
    { answer: 5, allowedError: 0.01, given: 5.01, right: true },
    { answer: 5, allowedError: 0.01, given: 4.99, right: true },
    { answer: 5, allowedError: 0.01, given: 5.02, right: false },
    { answer: 5, allowedError: 0.01, given: 4.98, right: false },
    // 0.4 - 0.3 is 0.10000000000000003 in floats.
    { answer: 0.3, allowedError: 0.1, given: 0.4, right: true },
    { answer: 0.3, allowedError: 0.1, given: 0.2, right: true },
    { answer: 0.3, allowedError: 0.1, given: 0.41, right: false },
    { answer: 5, allowedError: 0, given: 5, right: true },
    { answer: 5, allowedError: 0, given: 5.001, right: false },
  ])("$given for $answer ± $allowedError is right: $right", ({ given, right, ...card }) => {
    expect(withinAllowedError(given, card)).toBe(right);
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
    const picked = pickCards(cards, [], 3);

    expect(new Set(ids(picked)).size).toBe(3);
    expect(ids(cards)).toEqual(expect.arrayContaining(ids(picked)));
    expect(ids(pickCards(cards, [], 10))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("picks the weakest Cards", () => {
    const reviews = [
      review("a", 1, "2026-11-15T10:00:00.000Z"),
      review("b", 1, "2026-11-15T10:01:00.000Z"),
      review("c", 1, "2026-11-15T10:02:00.000Z", false),
      review("d", 1, "2026-11-15T10:03:00.000Z"),
    ];

    expect(pickCards(cards, reviews, 2).map((card) => card.id)).toEqual(["e", "c"]);
  });

  it("keeps only Cards with the tag as domain or topic tag", () => {
    const mixed = [
      tagged(qa("domain", 1), ["Regression"], ["Bias"]),
      tagged(qa("topic", 1), ["Statistics"], ["Regression"]),
      tagged(qa("neither", 1), ["Statistics"], ["Bias"]),
    ];

    expect(ids(pickCards(mixed, [], 10, "Regression"))).toEqual(["domain", "topic"]);
  });
});
