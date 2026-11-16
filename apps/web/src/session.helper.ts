import type { TCard, TCardNumeric } from "@flashcards/cards";

/** Whether `given` is within the Card's allowed error; a tiny slack keeps an answer on the edge right despite float rounding. */
export function withinAllowedError(
  given: number,
  card: Pick<TCardNumeric, "answer" | "allowedError">,
): boolean {
  return (
    Math.abs(given - card.answer) <=
    card.allowedError + 1e-9 * Math.max(1, Math.abs(card.answer))
  );
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
