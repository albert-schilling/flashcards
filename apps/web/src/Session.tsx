import { useState } from "react";
import { CardChoice } from "./CardChoice";
import { CardQA } from "./CardQA";
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
    case "multiple_choice":
      return (
        <CardChoice
          prompt={card.en.question}
          options={card.en.options}
          answerIndex={card.answerIndex}
          explanation={card.en.explanation}
          onAnswer={props.onAnswer}
          onNext={props.onNext}
        />
      );
    case "true_false":
      return (
        <CardChoice
          prompt={card.en.statement}
          options={["True", "False"]}
          answerIndex={card.answer ? 0 : 1}
          onAnswer={props.onAnswer}
          onNext={props.onNext}
        />
      );
  }
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
