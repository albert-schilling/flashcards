import type { TCardQA } from "@flashcards/cards";
import { useState } from "react";
import { addReview } from "./storage";

// The one place Card text is chosen, so a German translation can plug in here.
function RevealAnswer(props: {
  card: TCardQA;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (right: boolean) => void;
}) {
  return (
    <>
      <p>{props.card.en.question}</p>
      {props.revealed ? (
        <>
          <p>{props.card.en.answer}</p>
          <button onClick={() => props.onGrade(true)}>Knew it</button>
          <button onClick={() => props.onGrade(false)}>Didn't know</button>
        </>
      ) : (
        <button onClick={props.onReveal}>Reveal</button>
      )}
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
      <RevealAnswer
        card={card}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onGrade={grade}
      />
    </section>
  );
}
