import { useState } from "react";
import { useText } from "./language.context";

/** Shows the `prompt` lines and Reveal; after Reveal, the `answer` lines with Knew it and Didn't know, which call `onGrade`. */
export function CardReveal(props: {
  prompt: string[];
  answer: string[];
  onGrade: (right: boolean) => void;
}) {
  const text = useText();
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      {props.prompt.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
      {revealed ? (
        <>
          {props.answer.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          <button className="button primary" onClick={() => props.onGrade(true)}>
            {text.knewIt}
          </button>
          <button className="button secondary" onClick={() => props.onGrade(false)}>
            {text.didntKnow}
          </button>
        </>
      ) : (
        <button className="button primary" onClick={() => setRevealed(true)}>
          {text.reveal}
        </button>
      )}
    </>
  );
}
