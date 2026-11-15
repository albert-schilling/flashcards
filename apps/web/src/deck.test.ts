import type { TCardQA } from "@flashcards/cards";
import { describe, expect, it } from "vitest";
import { uploadDeck } from "./deck";
import { loadCards } from "./storage";

function qa(id: string, version: number, answer = "An answer."): TCardQA {
  return {
    id,
    version,
    tags: { domain: ["Machine Learning"], topic: ["Decision Tree"] },
    sourceIds: [],
    lesson: "lesson-04",
    type: "qa",
    en: { question: `What is ${id}?`, answer },
  };
}

function deck(...cards: unknown[]): string {
  return JSON.stringify({ cards });
}

describe("a valid Deck", () => {
  it("stores the Cards of a new Deck and counts them as added", async () => {
    const report = await uploadDeck(deck(qa("b", 1), qa("a", 1)));

    expect(report).toEqual({ ok: true, added: 2, updated: 0, unchanged: 0, errors: [] });
    expect(await loadCards()).toEqual([qa("a", 1), qa("b", 1)]);
  });

  it("counts a Card uploaded again as unchanged, even with its keys in another order", async () => {
    await uploadDeck(deck(qa("a", 1)));
    const card = qa("a", 1);
    const reordered = {
      en: { answer: card.en.answer, question: card.en.question },
      type: card.type,
      lesson: card.lesson,
      sourceIds: card.sourceIds,
      tags: { topic: card.tags.topic, domain: card.tags.domain },
      version: card.version,
      id: card.id,
    };

    const report = await uploadDeck(deck(reordered));

    expect(report).toEqual({ ok: true, added: 0, updated: 0, unchanged: 1, errors: [] });
  });
});

describe("an invalid file", () => {
  it("rejects a file that is not JSON", async () => {
    const report = await uploadDeck("not a Deck");

    expect(report).toEqual({ ok: false, errors: [{ message: expect.any(String) }] });
    expect(await loadCards()).toEqual([]);
  });

  it.each([
    ["null", "null"],
    ["an object without Cards", "{}"],
    ["a Deck with an unknown key", JSON.stringify({ cards: [], name: "Trees" })],
  ])("rejects JSON that is not a Deck (%s) without a Card ID", async (_, text) => {
    const report = await uploadDeck(text);

    expect(report).toEqual({ ok: false, errors: [{ message: expect.any(String) }] });
    expect(await loadCards()).toEqual([]);
  });

  it("rejects an invalid Deck with the Card ID and field of each error and stores nothing", async () => {
    // JSON.stringify drops the undefined ID, so the third Card has none.
    const withoutId = { ...qa("unused", 1), id: undefined };

    const report = await uploadDeck(deck(qa("a", 1), qa("bad.answer", 1, ""), withoutId));

    expect(report).toEqual({
      ok: false,
      errors: [
        { cardId: "bad.answer", field: "en.answer", message: expect.any(String) },
        { cardId: "card 3", field: "id", message: expect.any(String) },
      ],
    });
    expect(await loadCards()).toEqual([]);
  });

  it("rejects a Deck with a duplicate Card ID and names the Card", async () => {
    const report = await uploadDeck(deck(qa("a", 1), qa("a", 2)));

    expect(report).toEqual({
      ok: false,
      errors: [{ cardId: "a", field: "id", message: expect.stringContaining("duplicate") }],
    });
    expect(await loadCards()).toEqual([]);
  });
});

describe("Card versions", () => {
  it("replaces a stored Card with a higher version", async () => {
    await uploadDeck(deck(qa("a", 1, "Old answer.")));

    const report = await uploadDeck(deck(qa("a", 2, "New answer.")));

    expect(report).toEqual({ ok: true, added: 0, updated: 1, unchanged: 0, errors: [] });
    expect(await loadCards()).toEqual([qa("a", 2, "New answer.")]);
  });

  it("rejects a Card with the same version but different content and stores the rest", async () => {
    await uploadDeck(deck(qa("a", 1, "Old answer.")));

    const report = await uploadDeck(deck(qa("a", 1, "New answer."), qa("b", 1)));

    expect(report).toEqual({
      ok: true,
      added: 1,
      updated: 0,
      unchanged: 0,
      errors: [{ cardId: "a", field: "version", message: expect.any(String) }],
    });
    expect(await loadCards()).toEqual([qa("a", 1, "Old answer."), qa("b", 1)]);
  });

  it("rejects a Card with a lower version and keeps the stored one", async () => {
    await uploadDeck(deck(qa("a", 2, "New answer.")));

    const report = await uploadDeck(deck(qa("a", 1, "Old answer.")));

    expect(report).toEqual({
      ok: true,
      added: 0,
      updated: 0,
      unchanged: 0,
      errors: [{ cardId: "a", field: "version", message: expect.any(String) }],
    });
    expect(await loadCards()).toEqual([qa("a", 2, "New answer.")]);
  });

  it("keeps stored Cards that are missing from a new Deck", async () => {
    await uploadDeck(deck(qa("a", 1), qa("b", 1)));

    const report = await uploadDeck(deck(qa("c", 1)));

    expect(report).toEqual({ ok: true, added: 1, updated: 0, unchanged: 0, errors: [] });
    expect(await loadCards()).toEqual([qa("a", 1), qa("b", 1), qa("c", 1)]);
  });
});
