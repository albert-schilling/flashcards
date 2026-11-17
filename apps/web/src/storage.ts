import type { TCard } from "@flashcards/cards";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { TLanguage } from "./language.context";

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
  settings: { key: string; value: string };
}

// Open and close per operation, so a later version upgrade is never blocked by an open connection.
async function withDatabase<T>(use: (db: IDBPDatabase<TFlashcardsDB>) => Promise<T>): Promise<T> {
  const db = await openDB<TFlashcardsDB>("flashcards", 3, {
    // Each store is created only by the upgrade from before the version that added it.
    upgrade(upgrading, oldVersion) {
      if (oldVersion < 1) upgrading.createObjectStore("cards", { keyPath: "id" });
      if (oldVersion < 2) {
        upgrading.createObjectStore("reviews", { keyPath: ["cardId", "answeredAt"] });
      }
      if (oldVersion < 3) upgrading.createObjectStore("settings");
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

/** Adds the Reviews whose Card ID and time are not stored yet, in one transaction; returns how many it added. */
export function addNewReviews(reviews: TReview[]): Promise<number> {
  return withDatabase(async (db) => {
    const tx = db.transaction("reviews", "readwrite");
    let added = 0;
    // Awaiting each one keeps a repeat in the list from passing the check twice.
    try {
      for (const review of reviews) {
        if ((await tx.store.getKey([review.cardId, review.answeredAt])) !== undefined) continue;
        await tx.store.add(review);
        added++;
      }
    } catch (error) {
      // An invalid key throws without aborting, so abort to drop the earlier adds.
      tx.done.catch(() => {});
      tx.abort();
      throw error;
    }
    await tx.done;
    return added;
  });
}

/** When the Review log was last downloaded, as an ISO time; undefined if never. */
export function loadLastDownload(): Promise<string | undefined> {
  return withDatabase((db) => db.get("settings", "lastDownload"));
}

/** Saves when the Review log was last downloaded. */
export function saveLastDownload(at: string): Promise<void> {
  return withDatabase(async (db) => {
    await db.put("settings", at, "lastDownload");
  });
}

/** The language the Learner picked; undefined if never picked or not a known language. */
export async function loadLanguage(): Promise<TLanguage | undefined> {
  const stored = await withDatabase((db) => db.get("settings", "language"));
  return stored === "en" || stored === "de" ? stored : undefined;
}

/** Saves the language the Learner picked. */
export function saveLanguage(language: TLanguage): Promise<void> {
  return withDatabase(async (db) => {
    await db.put("settings", language, "language");
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
