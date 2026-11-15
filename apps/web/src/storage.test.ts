import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import { addReview, loadCards, loadReviews, type TReview } from "./storage";
import { qa } from "./test/cards.fixtures";

function review(cardId: string, answeredAt: string, right = true): TReview {
  return { cardId, cardVersion: 1, answeredAt, right, durationMs: 3000 };
}

describe("the Review log", () => {
  it("appends Reviews and loads them all", async () => {
    await addReview(review("a", "2026-11-15T10:00:00.000Z"));
    await addReview(review("a", "2026-11-15T10:05:00.000Z", false));
    await addReview(review("b", "2026-11-15T10:01:00.000Z"));

    expect(await loadReviews()).toEqual([
      review("a", "2026-11-15T10:00:00.000Z"),
      review("a", "2026-11-15T10:05:00.000Z", false),
      review("b", "2026-11-15T10:01:00.000Z"),
    ]);
  });

  it("a Review with a stored Card ID and time is rejected, and the stored one stays", async () => {
    await addReview(review("a", "2026-11-15T10:00:00.000Z"));

    await expect(addReview(review("a", "2026-11-15T10:00:00.000Z", false))).rejects.toMatchObject({
      name: "ConstraintError",
    });
    expect(await loadReviews()).toEqual([review("a", "2026-11-15T10:00:00.000Z")]);
  });

  it("upgrading from version 1 keeps the stored Cards and adds the Review log", async () => {
    // The database as the first release left it: version 1 with only the Cards.
    const v1 = await openDB("flashcards", 1, {
      upgrade(db) {
        db.createObjectStore("cards", { keyPath: "id" });
      },
    });
    await v1.put("cards", qa("a", 1));
    v1.close();

    await addReview(review("a", "2026-11-15T10:00:00.000Z"));

    expect(await loadCards()).toEqual([qa("a", 1)]);
    expect(await loadReviews()).toEqual([review("a", "2026-11-15T10:00:00.000Z")]);
  });
});
