import type { TCardQA } from "@flashcards/cards";
import { useState } from "react";
import type { TCardAnswerable } from "./session.helper";
import { addReview } from "./storage";

// The one place Card text is chosen, so a German translation can plug in here.
function CardView(props: {
  card: TCardAnswerable;
  onAnswer: (right: boolean) => void;
  onNext: () => void;
}) {
  const { card } = props;
  switch (card.type) {
    case "qa":
      return (
        <CardQA
          card={card}
          onGrade={(right) => {
            props.onAnswer(right);
            props.onNext();
          }}
        />
      );
  }
}

function CardQA(props: { card: TCardQA; onGrade: (right: boolean) => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <p>{props.card.en.question}</p>
      {revealed ? (
        <>
          <p>{props.card.en.answer}</p>
          <button onClick={() => props.onGrade(true)}>Knew it</button>
          <button onClick={() => props.onGrade(false)}>Didn't know</button>
        </>
      ) : (
        <button onClick={() => setRevealed(true)}>Reveal</button>
      )}
    </>
  );
}

/** Shows the Cards in order, appends a Review for each answer, then a summary; `onEnd` leaves it. */
export function Session(props: {
  cards: TCardAnswerable[];
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
