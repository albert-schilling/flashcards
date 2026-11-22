import type { TCard } from "@flashcards/cards";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { CardView } from "./CardView";
import { useText } from "./language.context";
import { addReview } from "./storage";

/** Shows Back, the progress (position / total, with a bar) and the Cards in order, then each one answered wrong once more, which adds one to the total; appends a Review for each answer, then a summary. Back calls `onBack` and keeps the place; Done calls `onEnd`. While hidden it keeps its place; when `shown` turns true again, the current Card's timer restarts, so time away doesn't count. */
export function Session(props: {
  cards: TCard[];
  shown: boolean;
  onBack: () => void;
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

  function answer(right: boolean) {
    if (!card) return;
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

  const total = queue.length;
  const position = card ? index + 1 : total;
  const percent = (position / total) * 100;

  return (
    <>
      <div className="session-toolbar">
        <button className="button ghost" onClick={props.onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          {text.back}
        </button>
        <div className="progress-copy">
          <span>
            {position} / {total}
          </span>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
      <div className="session-stage">
        {card ? (
          <section className="panel">
            <CardView key={index} card={card} onAnswer={answer} onNext={next} />
          </section>
        ) : (
          <section className="summary-card">
            <span className="summary-icon">
              <Check size={30} aria-hidden="true" />
            </span>
            <p className="eyebrow">{text.sessionComplete}</p>
            <h1>{text.sessionResult(index, rightCount)}</h1>
            <p>{text.sessionEncouragement}</p>
            <button className="button primary large" onClick={props.onEnd}>
              {text.done}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </section>
        )}
      </div>
    </>
  );
}
