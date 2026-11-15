import type { TCard } from "@flashcards/cards";

/** The Card types a Session can show; the others come later. */
export type TCardAnswerable = Extract<TCard, { type: "qa" | "multiple_choice" | "true_false" }>;

/** Whether a Session can show this Card yet. */
export function canAnswer(card: TCard): card is TCardAnswerable {
  return card.type === "qa" || card.type === "multiple_choice" || card.type === "true_false";
}

/** Every domain and topic tag of the Cards, sorted, each once. */
export function allTags(cards: TCard[]): string[] {
  return [...new Set(cards.flatMap((card) => [...card.tags.domain, ...card.tags.topic]))].sort();
}

/** Up to `size` Cards in random order, only those with `tag` as a domain or topic tag if given. */
export function pickCards<T extends TCard>(cards: T[], size: number, tag?: string): T[] {
  const picked = cards.filter(
    (card) => !tag || card.tags.domain.includes(tag) || card.tags.topic.includes(tag),
  );
  // Fisher–Yates.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked.slice(0, size);
}
