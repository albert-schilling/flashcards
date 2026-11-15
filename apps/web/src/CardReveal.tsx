import { useState } from "react";

/** Shows the `prompt` lines and Reveal; after Reveal, the `answer` lines with Knew it and Didn't know, which call `onGrade`. */
export function CardReveal(props: {
  prompt: string[];
  answer: string[];
  onGrade: (right: boolean) => void;
}) {
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
          <button onClick={() => props.onGrade(true)}>Knew it</button>
          <button onClick={() => props.onGrade(false)}>Didn't know</button>
        </>
      ) : (
        <button onClick={() => setRevealed(true)}>Reveal</button>
      )}
    </>
  );
}
