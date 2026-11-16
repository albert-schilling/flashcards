import { describe, expect, it } from "vitest";
import { uploadReviewLog } from "./review.log";
import { addReview, loadReviews } from "./storage";
import { review } from "./test/cards.fixtures";

function log(...reviews: unknown[]): string {
  return JSON.stringify({ reviews });
}

describe("a valid Review log", () => {
  it("adds new Reviews and skips stored ones and repeats in the file", async () => {
    await addReview(review("a", 1, "2026-11-15T10:00:00.000Z", true));

    const report = await uploadReviewLog(
      log(
        // Same Card ID and time as the stored Review, so the stored one wins.
        review("a", 1, "2026-11-15T10:00:00.000Z", false),
        review("b", 1, "2026-11-15T10:01:00.000Z"),
        review("b", 1, "2026-11-15T10:01:00.000Z"),
        review("c", 2, "2026-11-15T10:02:00.000Z"),
      ),
    );

    expect(report).toEqual({ ok: true, added: 2, skipped: 2 });
    expect(await loadReviews()).toEqual([
      review("a", 1, "2026-11-15T10:00:00.000Z", true),
      review("b", 1, "2026-11-15T10:01:00.000Z"),
      review("c", 2, "2026-11-15T10:02:00.000Z"),
    ]);
  });

  it("adds Reviews of Cards that are not stored", async () => {
    const report = await uploadReviewLog(log(review("gone", 3, "2026-11-15T10:00:00.000Z")));

    expect(report).toEqual({ ok: true, added: 1, skipped: 0 });
    expect(await loadReviews()).toEqual([review("gone", 3, "2026-11-15T10:00:00.000Z")]);
  });
});

describe("an invalid file", () => {
  it.each([
    ["not JSON", "not a Review log"],
    ["null", "null"],
    ["an object without Reviews", "{}"],
    ["a Review log with an unknown key", JSON.stringify({ reviews: [], name: "Laptop" })],
  ])("rejects a file that is not a Review log (%s) and stores nothing", async (_, text) => {
    const report = await uploadReviewLog(text);

    expect(report).toEqual({ ok: false, errors: [{ message: expect.any(String) }] });
    expect(await loadReviews()).toEqual([]);
  });

  it("rejects an invalid Review with its position and field", async () => {
    const report = await uploadReviewLog(
      log(
        review("a", 1, "2026-11-15T10:00:00.000Z"),
        review("b", 0, "2026-11-15T10:01:00.000Z"),
        review("c", 1, "yesterday"),
        42,
      ),
    );

    expect(report).toEqual({
      ok: false,
      errors: [
        { where: "review 2", field: "cardVersion", message: expect.any(String) },
        { where: "review 3", field: "answeredAt", message: expect.any(String) },
        { where: "review 4", message: expect.any(String) },
      ],
    });
    expect(await loadReviews()).toEqual([]);
  });

  it.each([
    ["an empty Card ID", { cardId: "" }, "cardId"],
    ["a fractional Card version", { cardVersion: 1.5 }, "cardVersion"],
    ["a right that is not a boolean", { right: "yes" }, "right"],
    ["a negative duration", { durationMs: -1 }, "durationMs"],
  ])("rejects a Review with %s", async (_, change, field) => {
    const report = await uploadReviewLog(
      log({ ...review("a", 1, "2026-11-15T10:00:00.000Z"), ...change }),
    );

    expect(report).toEqual({
      ok: false,
      errors: [{ where: "review 1", field, message: expect.any(String) }],
    });
  });
});
