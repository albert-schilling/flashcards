import { CircleCheck, CircleX } from "lucide-react";
import { useText } from "./language.context";

export function CardVerdict(props: { right: boolean; answer: string; explanation?: string }) {
  const text = useText();
  const Icon = props.right ? CircleCheck : CircleX;
  return (
    <div className={`feedback ${props.right ? "right" : "wrong"}`} role="status">
      <Icon size={24} aria-hidden="true" />
      <div>
        <strong>{props.right ? text.right : text.wrong}</strong>
        <p>{text.correctAnswer(props.answer)}</p>
        {props.explanation && <span>{props.explanation}</span>}
      </div>
    </div>
  );
}
