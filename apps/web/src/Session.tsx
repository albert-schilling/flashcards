import { useState } from "react";
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

/** Options to click. The click answers; then it shows right or wrong, the right option, the explanation if any, and Next. */
function CardChoice(props: {
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  onAnswer: (right: boolean) => void;
  onNext: () => void;
}) {
  const [picked, setPicked] = useState<number>();
  return (
    <>
      <p>{props.prompt}</p>
      {/* Keyed by position: options may repeat, and never reorder. */}
      {props.options.map((option, i) => (
        <button
          key={i}
          disabled={picked !== undefined}
          onClick={() => {
            setPicked(i);
            props.onAnswer(i === props.answerIndex);
          }}
        >
          {option}
        </button>
      ))}
      {picked !== undefined && (
        <>
          <p>{picked === props.answerIndex ? "Right." : "Wrong."}</p>
          <p>Answer: {props.options[props.answerIndex]}</p>
          {props.explanation && <p>{props.explanation}</p>}
          <button onClick={props.onNext}>Next</button>
        </>
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
