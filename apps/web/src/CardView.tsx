import { CardChoice } from "./CardChoice";
import { CardReveal } from "./CardReveal";
import type { TCardAnswerable } from "./session.helper";

// The one place Card text is chosen, so a German translation can plug in here.
export function CardView(props: {
  card: TCardAnswerable;
  onAnswer: (right: boolean) => void;
  onNext: () => void;
}) {
  const { card } = props;
  switch (card.type) {
    case "qa":
      return (
        <CardReveal
          prompt={[card.en.question]}
          answer={[card.en.answer]}
          onGrade={(right) => {
            props.onAnswer(right);
            props.onNext();
          }}
        />
      );
    case "multiple_choice":
      return (
        <CardChoice
          prompt={card.en.question}
          options={card.en.options}
          answerIndex={card.answerIndex}
          explanation={card.en.explanation}
          onAnswer={props.onAnswer}
          onNext={props.onNext}
        />
      );
    case "true_false":
      return (
        <CardChoice
          prompt={card.en.statement}
          options={["True", "False"]}
          answerIndex={card.answer ? 0 : 1}
          onAnswer={props.onAnswer}
          onNext={props.onNext}
        />
      );
  }
}
