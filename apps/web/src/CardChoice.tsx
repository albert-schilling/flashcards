import { Check, X } from "lucide-react";
import { useState } from "react";
import { CardVerdict } from "./CardVerdict";
import { StudyCard, type TStudyCardFrame } from "./StudyCard";

export function CardChoice(props: {
  frame: TStudyCardFrame;
  options: string[];
  answerIndex: number;
  explanation?: string;
  onAnswer: (right: boolean) => void;
  onNext: () => void;
}) {
  const [picked, setPicked] = useState<number>();
  const answered = picked !== undefined;
  return (
    <StudyCard frame={props.frame} onNext={answered ? props.onNext : undefined}>
      <div className="options">
        {/* Keyed by position: options may repeat, and never reorder. */}
        {props.options.map((option, i) => {
          const status = !answered
            ? ""
            : i === props.answerIndex
              ? "correct"
              : i === picked
                ? "incorrect"
                : "";
          return (
            <button
              className={`option-button ${status}`}
              key={i}
              disabled={answered}
              onClick={() => {
                setPicked(i);
                props.onAnswer(i === props.answerIndex);
              }}
            >
              <span className="option-marker" aria-hidden="true">
                {status === "correct" ? (
                  <Check size={17} />
                ) : status === "incorrect" ? (
                  <X size={17} />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <CardVerdict
          right={picked === props.answerIndex}
          answer={props.options[props.answerIndex]}
          explanation={props.explanation}
        />
      )}
    </StudyCard>
  );
}
