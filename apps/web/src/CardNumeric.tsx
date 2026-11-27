import { useId, useState } from "react";
import { CardVerdict } from "./CardVerdict";
import { useText } from "./language.context";
import { withinAllowedError } from "./session.helper";
import { StudyCard, type TStudyCardFrame } from "./StudyCard";

/** A form, so Enter answers as Check does. */
export function CardNumeric(props: {
  frame: TStudyCardFrame;
  answer: number;
  allowedError: number;
  unit?: string;
  onAnswer: (right: boolean) => void;
  onNext: () => void;
}) {
  const text = useText();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [right, setRight] = useState<boolean>();
  const answered = right !== undefined;
  return (
    <StudyCard frame={props.frame} onNext={answered ? props.onNext : undefined}>
      <form
        className="numeric-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (answered || typed === "") return;
          const isRight = withinAllowedError(Number(typed), props);
          setRight(isRight);
          props.onAnswer(isRight);
        }}
      >
        <div className="field">
          <label htmlFor={inputId}>{text.answer}</label>
          <span className="input-with-unit">
            <input
              id={inputId}
              className="control"
              type="number"
              step="any"
              value={typed}
              disabled={answered}
              onChange={(event) => setTyped(event.target.value)}
            />
            {props.unit && <span>{props.unit}</span>}
          </span>
        </div>
        {!answered && (
          <button className="button primary" disabled={typed === ""}>
            {text.check}
          </button>
        )}
      </form>
      {answered && (
        <CardVerdict
          right={right}
          answer={props.unit ? `${props.answer} ${props.unit}` : String(props.answer)}
        />
      )}
    </StudyCard>
  );
}
