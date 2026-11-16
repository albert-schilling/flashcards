/** After an answer: right or wrong, the right answer, the explanation if any, and Next. */
export function CardVerdict(props: {
  right: boolean;
  answer: string;
  explanation?: string;
  onNext: () => void;
}) {
  return (
    <>
      <p>{props.right ? "Right." : "Wrong."}</p>
      <p>Answer: {props.answer}</p>
      {props.explanation && <p>{props.explanation}</p>}
      <button onClick={props.onNext}>Next</button>
    </>
  );
}
