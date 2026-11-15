import type { Card } from "@flashcards/cards";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface FlashcardsDB extends DBSchema {
  cards: { key: string; value: Card };
}

// Open and close per operation, so a later version upgrade is never blocked by an open connection.
async function withDatabase<T>(use: (db: IDBPDatabase<FlashcardsDB>) => Promise<T>): Promise<T> {
  const db = await openDB<FlashcardsDB>("flashcards", 1, {
    upgrade(upgrading) {
      upgrading.createObjectStore("cards", { keyPath: "id" });
    },
  });
  try {
    return await use(db);
  } finally {
    db.close();
  }
}

/** The Cards stored in the browser, in ID order. */
export function loadCards(): Promise<Card[]> {
  return withDatabase((db) => db.getAll("cards"));
}

/** Stores the Cards, replacing any stored Card with the same ID. */
export function saveCards(cards: Card[]): Promise<void> {
  return withDatabase(async (db) => {
    const tx = db.transaction("cards", "readwrite");
    await Promise.all([...cards.map((card) => tx.store.put(card)), tx.done]);
  });
}
