import { useState } from "react";
import { CardVerdict } from "./CardVerdict";

/** Options to click. The click answers; then it shows right or wrong, the right option, the explanation if any, and Next. */
export function CardChoice(props: {
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
        <CardVerdict
          right={picked === props.answerIndex}
          answer={props.options[props.answerIndex]}
          explanation={props.explanation}
          onNext={props.onNext}
        />
      )}
    </>
  );
}
