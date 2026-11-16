import type { TCard } from "@flashcards/cards";
import type { TReview } from "./storage";

/** Statistics of one Card, from the Reviews of its current version only. */
export type TCardStatistics = {
  card: TCard;
  reviews: number;
  right: number;
  lastReviewedAt?: string;
};

/** Totals of one tag over the Cards that have it. */
export type TTagStatistics = { tag: string; cards: number; reviews: number; right: number };

export type TStatistics = {
  cards: TCardStatistics[];
  domain: TTagStatistics[];
  topic: TTagStatistics[];
};

function totals(cards: TCardStatistics[], pick: (card: TCard) => string[]): TTagStatistics[] {
  const byTag = new Map<string, TTagStatistics>();
  for (const { card, reviews, right } of cards) {
    for (const tag of pick(card)) {
      const total = byTag.get(tag) ?? { tag, cards: 0, reviews: 0, right: 0 };
      total.cards++;
      total.reviews += reviews;
      total.right += right;
      byTag.set(tag, total);
    }
  }
  return [...byTag.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Statistics of the given Cards from the Review log; Reviews of an older version or of a Card not given don't count. */
export function statistics(cards: TCard[], reviews: TReview[]): TStatistics {
  const perCard = cards.map((card): TCardStatistics => {
    const current = reviews.filter((r) => r.cardId === card.id && r.cardVersion === card.version);
    return {
      card,
      reviews: current.length,
      right: current.filter((r) => r.right).length,
      // ISO times in one format sort as text, so the last one is the latest.
      lastReviewedAt: current
        .map((r) => r.answeredAt)
        .sort()
        .at(-1),
    };
  });
  return {
    cards: perCard,
    domain: totals(perCard, (card) => card.tags.domain),
    topic: totals(perCard, (card) => card.tags.topic),
  };
}
