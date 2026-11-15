import type { TCard } from "@flashcards/cards";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/** One answer to one version of one Card. With `cardId`, `answeredAt` (an ISO time) identifies the Review. */
export type TReview = {
  cardId: string;
  cardVersion: number;
  answeredAt: string;
  right: boolean;
  durationMs: number;
};

interface TFlashcardsDB extends DBSchema {
  cards: { key: string; value: TCard };
  reviews: { key: [string, string]; value: TReview };
}

// Open and close per operation, so a later version upgrade is never blocked by an open connection.
async function withDatabase<T>(use: (db: IDBPDatabase<TFlashcardsDB>) => Promise<T>): Promise<T> {
  const db = await openDB<TFlashcardsDB>("flashcards", 2, {
    // Each store is created only by the upgrade from before the version that added it.
    upgrade(upgrading, oldVersion) {
      if (oldVersion < 1) upgrading.createObjectStore("cards", { keyPath: "id" });
      if (oldVersion < 2) {
        upgrading.createObjectStore("reviews", { keyPath: ["cardId", "answeredAt"] });
      }
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

/** Appends a Review to the Review log; fails rather than overwrite a stored Review. */
export function addReview(review: TReview): Promise<void> {
  return withDatabase(async (db) => {
    await db.add("reviews", review);
  });
}

/** Every Review in the Review log. */
export function loadReviews(): Promise<TReview[]> {
  return withDatabase((db) => db.getAll("reviews"));
}

/** Stores the Cards, replacing any stored Card with the same ID. */
export function saveCards(cards: TCard[]): Promise<void> {
  return withDatabase(async (db) => {
    const tx = db.transaction("cards", "readwrite");
    await Promise.all([...cards.map((card) => tx.store.put(card)), tx.done]);
  });
}
