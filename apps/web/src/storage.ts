import type { TCard } from "@flashcards/cards";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface TFlashcardsDB extends DBSchema {
  cards: { key: string; value: TCard };
}

// Open and close per operation, so a later version upgrade is never blocked by an open connection.
async function withDatabase<T>(use: (db: IDBPDatabase<TFlashcardsDB>) => Promise<T>): Promise<T> {
  const db = await openDB<TFlashcardsDB>("flashcards", 1, {
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
export function loadCards(): Promise<TCard[]> {
  return withDatabase((db) => db.getAll("cards"));
}

/** Removes the stored Card with this ID; Reviews of it stay in the Review log. */
export function deleteCard(id: string): Promise<void> {
  return withDatabase((db) => db.delete("cards", id));
}

/** Removes every stored Card; the Review log stays. */
export function clearCards(): Promise<void> {
  return withDatabase((db) => db.clear("cards"));
}

/** Stores the Cards, replacing any stored Card with the same ID. */
export function saveCards(cards: TCard[]): Promise<void> {
  return withDatabase(async (db) => {
    const tx = db.transaction("cards", "readwrite");
    await Promise.all([...cards.map((card) => tx.store.put(card)), tx.done]);
  });
}
