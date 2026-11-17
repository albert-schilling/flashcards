import { useText } from "./language.context";

/** After an answer: right or wrong, the right answer, the explanation if any, and Next. */
export function CardVerdict(props: {
  right: boolean;
  answer: string;
  explanation?: string;
  onNext: () => void;
}) {
  const text = useText();
  return (
    <>
      <p>{props.right ? text.right : text.wrong}</p>
      <p>{text.correctAnswer(props.answer)}</p>
      {props.explanation && <p>{props.explanation}</p>}
      <button onClick={props.onNext}>{text.next}</button>
    </>
  );
}
