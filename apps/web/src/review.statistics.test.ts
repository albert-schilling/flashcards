import { describe, expect, it } from "vitest";
import { statistics, weakestFirst } from "./review.statistics";
import { qa, review, tagged } from "./test/cards.fixtures";

const ids = (cards: { id: string }[]) => cards.map((card) => card.id);

describe("statistics", () => {
  it("counts each Card's Reviews and right ones, and its latest Review", () => {
    const b = qa("b", 1);
    const a = qa("a", 1);
    // The log is not in time order: the latest Review comes second.
    const reviews = [
      review("a", 1, "2026-11-14T10:00:00.000Z"),
      review("a", 1, "2026-11-15T10:00:00.000Z", false),
      review("a", 1, "2026-11-13T10:00:00.000Z"),
    ];

    expect(statistics([b, a], reviews).cards).toEqual([
      { card: b, reviews: 0, right: 0 },
      { card: a, reviews: 3, right: 2, lastReviewedAt: "2026-11-15T10:00:00.000Z" },
    ]);
  });

  it("totals each domain and topic tag over its Cards, sorted", () => {
    const x = tagged(qa("x", 1), ["Statistics", "Machine Learning"], ["Regression"]);
    const y = tagged(qa("y", 1), ["Statistics"], ["Statistics", "Bias"]);
    const unreviewed = tagged(qa("z", 1), ["Machine Learning"], ["Regression"]);
    const reviews = [
      review("x", 1, "2026-11-15T10:00:00.000Z"),
      review("x", 1, "2026-11-15T10:01:00.000Z", false),
      review("y", 1, "2026-11-15T10:02:00.000Z"),
    ];

    const { domain, topic } = statistics([x, y, unreviewed], reviews);

    expect(domain).toEqual([
      { tag: "Machine Learning", cards: 2, reviews: 2, right: 1 },
      { tag: "Statistics", cards: 2, reviews: 3, right: 2 },
    ]);
    expect(topic).toEqual([
      { tag: "Bias", cards: 1, reviews: 1, right: 1 },
      { tag: "Regression", cards: 2, reviews: 2, right: 1 },
      { tag: "Statistics", cards: 1, reviews: 1, right: 1 },
    ]);
  });

  it("ignores Reviews of an older version and of Cards not given", () => {
    const card = qa("a", 2);
    const reviews = [
      review("a", 2, "2026-11-14T10:00:00.000Z", false),
      // Later than the current-version Review, so it would be the latest if it counted.
      review("a", 1, "2026-11-15T10:00:00.000Z"),
      review("deleted", 1, "2026-11-15T11:00:00.000Z"),
    ];

    expect(statistics([card], reviews)).toEqual({
      cards: [{ card, reviews: 1, right: 0, lastReviewedAt: "2026-11-14T10:00:00.000Z" }],
      domain: [{ tag: "Machine Learning", cards: 1, reviews: 1, right: 0 }],
      topic: [{ tag: "Decision Tree", cards: 1, reviews: 1, right: 0 }],
    });
  });
});

describe("weakestFirst", () => {
  it("orders Cards never reviewed first, then by share right over the last 5 Reviews, ties to the one reviewed longest ago", () => {
    const cards = ["steady-new", "steady-old", "half", "slipping", "z-unseen", "a-unseen"].map(
      (id) => qa(id, 1),
    );
    const reviews = [
      review("steady-new", 1, "2026-11-13T10:00:00.000Z"),
      review("steady-old", 1, "2026-11-09T10:00:00.000Z"),
      review("half", 1, "2026-11-11T10:00:00.000Z"),
      review("half", 1, "2026-11-11T11:00:00.000Z", false),
      // 6 of 10 right in all, so after "half"; but 1 of the last 5, so before it.
      ...[10, 11, 12, 13, 14].map((h) => review("slipping", 1, `2026-11-10T${h}:00:00.000Z`)),
      ...[10, 11, 12, 13, 14].map((h) =>
        review("slipping", 1, `2026-11-12T${h}:00:00.000Z`, h === 10),
      ),
    ].reverse(); // The log is not in time order.

    expect(ids(weakestFirst(cards, reviews))).toEqual([
      "z-unseen",
      "a-unseen",
      "slipping",
      "half",
      "steady-old",
      "steady-new",
    ]);
  });

  it("counts only Reviews of the current version", () => {
    const half = qa("half", 1);
    const missed = qa("missed", 2);
    const unseen = qa("unseen", 2);
    const reviews = [
      review("half", 1, "2026-11-10T10:00:00.000Z"),
      review("half", 1, "2026-11-10T11:00:00.000Z", false),
      review("missed", 1, "2026-11-11T10:00:00.000Z"),
      review("missed", 1, "2026-11-11T11:00:00.000Z"),
      review("missed", 2, "2026-11-12T10:00:00.000Z", false),
      review("unseen", 1, "2026-11-12T11:00:00.000Z"),
    ];

    expect(ids(weakestFirst([half, missed, unseen], reviews))).toEqual([
      "unseen",
      "missed",
      "half",
    ]);
  });
});
