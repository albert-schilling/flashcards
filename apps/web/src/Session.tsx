import type { TCardQA } from "@flashcards/cards";
import { useState } from "react";
import { addReview } from "./storage";

// The one place Card text is chosen, so a German translation can plug in here.
function RevealAnswer({ card, onGrade }: { card: TCardQA; onGrade: (right: boolean) => void }) {
  return (
    <>
      <p>{card.en.answer}</p>
      <button onClick={() => onGrade(true)}>Knew it</button>
      <button onClick={() => onGrade(false)}>Didn't know</button>
    </>
  );
}

/** Shows the Cards in order, appends a Review for each answer, then a summary; `onEnd` leaves it. */
export function Session(props: {
  cards: TCardQA[];
  onEnd: () => void;
  onError: (failure: unknown) => void;
}) {
  const [index, setIndex] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [shownAt, setShownAt] = useState(Date.now());

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

  function grade(right: boolean) {
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
    setIndex(index + 1);
    setRevealed(false);
    setShownAt(Date.now());
  }

  return (
    <section>
      <p>{card.en.question}</p>
      {revealed ? (
        <RevealAnswer card={card} onGrade={grade} />
      ) : (
        <button onClick={() => setRevealed(true)}>Reveal</button>
      )}
    </section>
  );
}
