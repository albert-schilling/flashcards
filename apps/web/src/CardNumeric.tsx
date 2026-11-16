import { useState } from "react";
import { CardVerdict } from "./CardVerdict";
import { withinAllowedError } from "./session.helper";

/** A number to type, with the unit after it; Check (or Enter) answers within the allowed error, then shows the verdict. */
export function CardNumeric(props: {
  prompt: string;
  answer: number;
  allowedError: number;
  unit?: string;
  onAnswer: (right: boolean) => void;
  onNext: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [right, setRight] = useState<boolean>();
  const answered = right !== undefined;
  return (
    <>
      <p>{props.prompt}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (answered || typed === "") return;
          const isRight = withinAllowedError(Number(typed), props);
          setRight(isRight);
          props.onAnswer(isRight);
        }}
      >
        <input
          type="number"
          step="any"
          aria-label="Answer"
          value={typed}
          disabled={answered}
          onChange={(event) => setTyped(event.target.value)}
        />
        {props.unit && (
          <>
            {" "}
            <span>{props.unit}</span>
          </>
        )}{" "}
        <button disabled={answered || typed === ""}>Check</button>
      </form>
      {answered && (
        <CardVerdict
          right={right}
          answer={props.unit ? `${props.answer} ${props.unit}` : String(props.answer)}
          onNext={props.onNext}
        />
      )}
    </>
  );
}
