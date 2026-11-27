import type { TCard } from "@flashcards/cards";
import { useContext, type ReactNode } from "react";
import { CardChoice } from "./CardChoice";
import { CardNumeric } from "./CardNumeric";
import { CardReveal } from "./CardReveal";
import { LanguageContext, useText, type TLanguage } from "./language.context";
import type { TStudyCardFrame } from "./StudyCard";
import { uiText } from "./ui.text";

// A cloze gap, `{{word}}`; the group is the word that fills it.
const gap = /\{\{(.+?)\}\}/g;

function withGapsBlank(text: string): string {
  return text.replaceAll(gap, "____");
}

// German fields replace English ones; a missing German field stays English.
function inLanguage(card: TCard, language: TLanguage): TCard {
  if (language === "en") return card;
  // The German fields are those of the same Card type, which TypeScript can't follow through the union.
  return { ...card, en: { ...card.en, ...card.translations?.de } } as TCard;
}

/** The list's text for a Card; a cloze shows its text with the gaps blank. */
export function cardTitle(card: TCard, language: TLanguage): string {
  const shown = inLanguage(card, language);
  switch (shown.type) {
    case "qa":
    case "multiple_choice":
    case "numeric":
      return shown.en.question;
    case "formula":
      return shown.en.name;
    case "cloze":
      return withGapsBlank(shown.en.text);
    case "true_false":
      return shown.en.statement;
  }
}

/** The Card preview's answer, one line per part; a cloze shows its gaps filled. */
export function cardAnswer(card: TCard, language: TLanguage): string[] {
  const shown = inLanguage(card, language);
  switch (shown.type) {
    case "qa":
      return [shown.en.answer];
    case "formula":
      return shown.en.example
        ? [shown.en.wordFormula, shown.formula, shown.en.example]
        : [shown.en.wordFormula, shown.formula];
    case "cloze":
      return [shown.en.text.replaceAll(gap, "$1")];
    case "multiple_choice":
      return [shown.en.options[shown.answerIndex], shown.en.explanation];
    case "true_false":
      return [shown.answer ? uiText[language].true : uiText[language].false];
    case "numeric":
      return [shown.unit ? `${shown.answer} ${shown.unit}` : String(shown.answer)];
  }
}

// The cloze answer: the text with every gap word marked. React nodes, never HTML, because Deck text is uploaded.
function clozeAnswer(text: string): ReactNode {
  // Splitting on a pattern with a group alternates plain text and gap words.
  return text.split(gap).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

// With cardTitle and cardAnswer above, the one place Card text is chosen.
export function CardView(props: {
  card: TCard;
  onAnswer: (right: boolean) => void;
  onNext: () => void;
}) {
  const text = useText();
  const card = inLanguage(props.card, useContext(LanguageContext));
  const grade = (right: boolean) => {
    props.onAnswer(right);
    props.onNext();
  };
  const frame = (prompt: string, detail?: string): TStudyCardFrame => ({
    type: card.type,
    tags: card.tags,
    prompt,
    detail,
  });
  switch (card.type) {
    case "qa":
      return (
        <CardReveal
          frame={frame(card.en.question)}
          answer={<p>{card.en.answer}</p>}
          onGrade={grade}
        />
      );
    case "formula":
      return (
        <CardReveal
          frame={frame(card.en.name, card.en.wordFormula)}
          answer={
            <>
              <p className="formula">{card.formula}</p>
              {card.en.example && <span className="example">{text.example(card.en.example)}</span>}
            </>
          }
          onGrade={grade}
        />
      );
    case "cloze":
      return (
        <CardReveal
          frame={frame(withGapsBlank(card.en.text))}
          answer={<p>{clozeAnswer(card.en.text)}</p>}
          onGrade={grade}
        />
      );
    case "multiple_choice":
      return (
        <CardChoice
          frame={frame(card.en.question)}
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
          frame={frame(card.en.statement)}
          options={[text.true, text.false]}
          answerIndex={card.answer ? 0 : 1}
          onAnswer={props.onAnswer}
          onNext={props.onNext}
        />
      );
    case "numeric":
      return (
        <CardNumeric
          frame={frame(card.en.question)}
          answer={card.answer}
          allowedError={card.allowedError}
          unit={card.unit}
          onAnswer={props.onAnswer}
          onNext={props.onNext}
        />
      );
  }
}
