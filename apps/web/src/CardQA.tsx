import type { TCardQA } from "@flashcards/cards";
import { useState } from "react";

/** Shows the question and Reveal; after Reveal, the answer with Knew it and Didn't know, which call `onGrade`. */
export function CardQA(props: { card: TCardQA; onGrade: (right: boolean) => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <p>{props.card.en.question}</p>
      {revealed ? (
        <>
          <p>{props.card.en.answer}</p>
          <button onClick={() => props.onGrade(true)}>Knew it</button>
          <button onClick={() => props.onGrade(false)}>Didn't know</button>
        </>
      ) : (
        <button onClick={() => setRevealed(true)}>Reveal</button>
      )}
    </>
  );
}
