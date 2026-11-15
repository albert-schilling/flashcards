import { deckSchema, type Card } from "@flashcards/cards";
import { loadCards, saveCards } from "./storage";

/** One problem with an uploaded Deck: which Card, which field, and what is wrong. */
export type DeckError = { cardId?: string; field?: string; message: string };

/** What an upload did. A file that is not a valid Deck stores nothing; otherwise each Card is added, updated, unchanged or rejected with an error. */
export type UploadReport =
  | { ok: false; errors: DeckError[] }
  | { ok: true; added: number; updated: number; unchanged: number; errors: DeckError[] };

type ReadDeck = { cards: Card[] } | { errors: DeckError[] };

function readDeck(text: string): ReadDeck {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { errors: [{ message: error instanceof Error ? error.message : "Not JSON" }] };
  }
  const result = deckSchema.safeParse(raw);
  if (result.success) return { cards: result.data.cards };

  const rawCards = (raw as { cards?: { id?: unknown }[] } | null)?.cards;
  return {
    errors: result.error.issues.map((issue) => {
      const [first, index, ...rest] = issue.path;
      if (first !== "cards" || typeof index !== "number") return { message: issue.message };
      const id = Array.isArray(rawCards) ? rawCards[index]?.id : undefined;
      return {
        cardId: typeof id === "string" ? id : `card ${index + 1}`,
        field: rest.join("."),
        message: issue.message,
      };
    }),
  };
}

// Zod output has the schema's key order, so equal content gives equal JSON.
function sameContent(a: Card, b: Card): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function merge(stored: Card[], cards: Card[]) {
  const storedById = new Map(stored.map((card) => [card.id, card]));
  const toSave: Card[] = [];
  const errors: DeckError[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const card of cards) {
    const old = storedById.get(card.id);
    if (!old) {
      added++;
      toSave.push(card);
    } else if (card.version > old.version) {
      updated++;
      toSave.push(card);
    } else if (card.version < old.version) {
      errors.push({
        cardId: card.id,
        field: "version",
        message: `Version ${card.version} is lower than the stored version ${old.version}.`,
      });
    } else if (sameContent(card, old)) {
      unchanged++;
    } else {
      errors.push({
        cardId: card.id,
        field: "version",
        message: `Content changed but the version is still ${card.version}; raise it.`,
      });
    }
  }
  return { toSave, added, updated, unchanged, errors };
}

/** Reads a Deck file and stores its Cards by the Card version rules: a higher version replaces the stored Card, the same version must have the same content, a lower version is rejected, and stored Cards missing from the Deck stay. */
export async function uploadDeck(text: string): Promise<UploadReport> {
  const deck = readDeck(text);
  if ("errors" in deck) return { ok: false, errors: deck.errors };

  const { toSave, ...report } = merge(await loadCards(), deck.cards);
  await saveCards(toSave);
  return { ok: true, ...report };
}
