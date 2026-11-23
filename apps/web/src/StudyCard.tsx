import type { TCard } from "@flashcards/cards";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { useText } from "./language.context";

/** What a study card shows above its answer: the Card type, one tag, the prompt and an optional line below it. */
export type TStudyCardFrame = {
  type: TCard["type"];
  tag: string;
  prompt: string;
  detail?: string;
};

/** The prototype's study card: type name, tag chip, the type's coloured strip and the prompt, then `children`. With `onNext`, Next follows below the card, outside the article. */
export function StudyCard(props: {
  frame: TStudyCardFrame;
  onNext?: () => void;
  children: ReactNode;
}) {
  const text = useText();
  const { frame } = props;
  return (
    <>
      <article className={`study-card type-${frame.type}`}>
        <div className="study-card-top">
          <span className="type-label">{text.cardTypes[frame.type]}</span>
          <span className="card-tag">{frame.tag}</span>
        </div>
        <div className="prompt">
          <h2>{frame.prompt}</h2>
          {frame.detail && <p>{frame.detail}</p>}
        </div>
        {props.children}
      </article>
      {props.onNext && (
        <button className="button primary large next-button" onClick={props.onNext}>
          {text.next}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
    </>
  );
}
