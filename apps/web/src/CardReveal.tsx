import { CircleCheck, CircleX } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useText } from "./language.context";
import { StudyCard, type TStudyCardFrame } from "./StudyCard";

/** Shows the study card and Reveal; after Reveal, `answer` in `.revealed-answer` with Didn't know and Knew it, which call `onGrade`. */
export function CardReveal(props: {
  frame: TStudyCardFrame;
  answer: ReactNode;
  onGrade: (right: boolean) => void;
}) {
  const text = useText();
  const [revealed, setRevealed] = useState(false);
  return (
    <StudyCard frame={props.frame}>
      {revealed ? (
        <>
          <div className="revealed-answer">
            <span className="answer-label">{text.answer}</span>
            {props.answer}
          </div>
          <div className="rating-actions">
            <button className="button secondary" onClick={() => props.onGrade(false)}>
              <CircleX size={18} aria-hidden="true" />
              {text.didntKnow}
            </button>
            <button className="button primary" onClick={() => props.onGrade(true)}>
              <CircleCheck size={18} aria-hidden="true" />
              {text.knewIt}
            </button>
          </div>
        </>
      ) : (
        <button className="button primary large reveal-button" onClick={() => setRevealed(true)}>
          {text.reveal}
        </button>
      )}
    </StudyCard>
  );
}
