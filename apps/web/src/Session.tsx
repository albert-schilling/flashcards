import type { TCard } from "@flashcards/cards";
import { useEffect, useState } from "react";
import { CardView } from "./CardView";
import { useText } from "./language.context";
import { addReview } from "./storage";

/** Shows the Cards in order, then each one answered wrong once more; appends a Review for each answer, then a summary; `onEnd` leaves it. While hidden it keeps its place; when `shown` turns true again, the current Card's timer restarts, so time away doesn't count. */
export function Session(props: {
  cards: TCard[];
  shown: boolean;
  onEnd: () => void;
  onError: (failure: unknown) => void;
}) {
  const text = useText();
  const [queue, setQueue] = useState(props.cards);
  const [index, setIndex] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [shownAt, setShownAt] = useState(() => Date.now());

  useEffect(() => {
    if (props.shown) setShownAt(Date.now());
  }, [props.shown]);

  const card = queue[index];

  if (!card) {
    return (
      <section className="panel">
        <p>{text.sessionResult(index, rightCount)}</p>
        <button className="button primary" onClick={props.onEnd}>
          {text.done}
        </button>
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
    // A Card answered wrong comes back once, at the end.
    else if (index < props.cards.length) setQueue([...queue, card]);
  }

  function next() {
    setIndex(index + 1);
    setShownAt(Date.now());
  }

  return (
    <section className="panel">
      <CardView key={index} card={card} onAnswer={answer} onNext={next} />
    </section>
  );
}
