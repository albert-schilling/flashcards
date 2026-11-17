import type { TCard } from "@flashcards/cards";
import { useContext } from "react";
import { CardChoice } from "./CardChoice";
import { CardNumeric } from "./CardNumeric";
import { CardReveal } from "./CardReveal";
import { LanguageContext, type TLanguage } from "./language.context";

// A cloze gap, `{{word}}`; the group is the word that fills it.
const gap = /\{\{(.+?)\}\}/g;

// German fields replace English ones; a missing German field stays English.
function inLanguage(card: TCard, language: TLanguage): TCard {
  if (language === "en") return card;
  // The German fields are those of the same Card type, which TypeScript can't follow through the union.
  return { ...card, en: { ...card.en, ...card.translations?.de } } as TCard;
}

// The one place Card text is chosen.
export function CardView(props: {
  card: TCard;
  onAnswer: (right: boolean) => void;
  onNext: () => void;
}) {
  const card = inLanguage(props.card, useContext(LanguageContext));
  const grade = (right: boolean) => {
    props.onAnswer(right);
    props.onNext();
  };
  switch (card.type) {
    case "qa":
      return <CardReveal prompt={[card.en.question]} answer={[card.en.answer]} onGrade={grade} />;
    case "formula":
      return (
        <CardReveal
          prompt={[card.en.name, card.en.wordFormula]}
          answer={card.en.example ? [card.formula, card.en.example] : [card.formula]}
          onGrade={grade}
        />
      );
    case "cloze":
      return (
        <CardReveal
          prompt={[card.en.text.replaceAll(gap, "____")]}
          answer={[card.en.text.replaceAll(gap, "$1")]}
          onGrade={grade}
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
    case "numeric":
      return (
        <CardNumeric
          prompt={card.en.question}
          answer={card.answer}
          allowedError={card.allowedError}
          unit={card.unit}
          onAnswer={props.onAnswer}
          onNext={props.onNext}
        />
      );
  }
}
