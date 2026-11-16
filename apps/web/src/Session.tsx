import { useState } from "react";
import type { TCard } from "@flashcards/cards";
import { CardView } from "./CardView";
import { addReview } from "./storage";

/** Shows the Cards in order, appends a Review for each answer, then a summary; `onEnd` leaves it. */
export function Session(props: {
  cards: TCard[];
  onEnd: () => void;
  onError: (failure: unknown) => void;
}) {
  const [index, setIndex] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [shownAt, setShownAt] = useState(() => Date.now());

  const card = props.cards[index];

  if (!card) {
    return (
      <section>
        <p>
          {index} answered, {rightCount} right
        </p>
        <button onClick={props.onEnd}>Done</button>
      </section>
    );
  }

  function answer(right: boolean) {
    const answeredAt = Date.now();
    // A failed write is shown, but the answer still counts.
    addReview({
      cardId: card.id,
      cardVersion: card.version,
      answeredAt: new Date(answeredAt).toISOString(),
      right,
      durationMs: answeredAt - shownAt,
    }).catch(props.onError);
    if (right) setRightCount(rightCount + 1);
  }

  function next() {
    setIndex(index + 1);
    setShownAt(Date.now());
  }

  return (
    <section>
      <CardView key={index} card={card} onAnswer={answer} onNext={next} />
    </section>
  );
}
