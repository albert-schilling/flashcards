import type { TCard, TCardQA } from "@flashcards/cards";

/** Whether a Session can show this Card yet; other Card types come in later issues. */
export function canAnswer(card: TCard): card is TCardQA {
  return card.type === "qa";
}

/** Every domain and topic tag of the Cards, sorted, each once. */
export function allTags(cards: TCard[]): string[] {
  return [...new Set(cards.flatMap((card) => [...card.tags.domain, ...card.tags.topic]))].sort();
}

/** Up to `size` Cards in random order, only those with `tag` as a domain or topic tag if given. */
export function pickCards<T extends TCard>(cards: T[], size: number, tag?: string): T[] {
  const shuffled = cards.filter(
    (card) => !tag || card.tags.domain.includes(tag) || card.tags.topic.includes(tag),
  );
  // Fisher–Yates.
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, size);
}
