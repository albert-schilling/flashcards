import { z } from "zod";

const ZText = z.string().min(1);

const shared = {
  id: z.string().regex(/^[a-z0-9]+([.-][a-z0-9]+)*$/, "lowercase words joined by dots or hyphens"),
  version: z.int().min(1),
  tags: z.strictObject({
    domain: z.array(ZText).min(1),
    topic: z.array(ZText).min(1),
  }),
  sourceIds: z.array(ZText),
  lesson: ZText,
};

/** Builds one Card type: `textShape` is the text to show, `fields` hold language-independent values. */
function cardType<Type extends string, Text extends z.ZodRawShape, Fields extends z.ZodRawShape>(
  type: Type,
  textShape: Text,
  fields: Fields,
) {
  return z.strictObject({
    ...shared,
    type: z.literal(type),
    en: z.strictObject(textShape),
    translations: z.strictObject({ de: z.strictObject(textShape).partial() }).optional(),
    ...fields,
  });
}

export const ZCardQA = cardType("qa", { question: ZText, answer: ZText }, {});

/** `answerIndex` points to the right option. */
export const ZCardMultipleChoice = cardType(
  "multiple_choice",
  { question: ZText, options: z.array(ZText).min(2), explanation: ZText },
  { answerIndex: z.int().min(0) },
).check((ctx) => {
  const { en, translations, answerIndex } = ctx.value;
  if (answerIndex >= en.options.length) {
    ctx.issues.push({
      code: "custom",
      input: ctx.value,
      path: ["answerIndex"],
      message: "answerIndex must point to an option",
    });
  }
  const germanOptions = translations?.de.options;
  if (germanOptions && germanOptions.length !== en.options.length) {
    ctx.issues.push({
      code: "custom",
      input: ctx.value,
      path: ["translations", "de", "options"],
      message: "German options must have as many entries as the English ones",
    });
  }
});

export const ZCardFormula = cardType(
  "formula",
  { name: ZText, wordFormula: ZText, readAloud: ZText.optional(), example: ZText.optional() },
  { formula: ZText, latex: ZText.optional() },
);

export const ZCardNumeric = cardType(
  "numeric",
  { question: ZText },
  { answer: z.number(), allowedError: z.number().min(0), unit: ZText.optional() },
);

export const ZCardCloze = cardType(
  "cloze",
  { text: z.string().regex(/\{\{.+?\}\}/, "needs a {{gap}}") },
  {},
);

export const ZCardTrueFalse = cardType("true_false", { statement: ZText }, { answer: z.boolean() });

/** One Card. Text to show is in `en`; `translations.de`, if present, has the same fields in German, any of which may be missing and then falls back to English. */
export const ZCard = z.discriminatedUnion("type", [
  ZCardQA,
  ZCardMultipleChoice,
  ZCardFormula,
  ZCardNumeric,
  ZCardCloze,
  ZCardTrueFalse,
]);

/** A Deck file: Cards with unique IDs. `$schema` lets an editor check the file against deck.schema.json. */
export const ZDeck = z
  .strictObject({
    $schema: z.string().optional(),
    cards: z.array(ZCard),
  })
  .check((ctx) => {
    const seen = new Set<string>();
    ctx.value.cards.forEach((card, index) => {
      if (seen.has(card.id)) {
        ctx.issues.push({
          code: "custom",
          input: ctx.value,
          path: ["cards", index, "id"],
          message: `duplicate ID ${card.id}`,
        });
      }
      seen.add(card.id);
    });
  });

export type TCardQA = z.infer<typeof ZCardQA>;
export type TCardMultipleChoice = z.infer<typeof ZCardMultipleChoice>;
export type TCardFormula = z.infer<typeof ZCardFormula>;
export type TCardNumeric = z.infer<typeof ZCardNumeric>;
export type TCardCloze = z.infer<typeof ZCardCloze>;
export type TCardTrueFalse = z.infer<typeof ZCardTrueFalse>;
export type TCard = z.infer<typeof ZCard>;
export type TDeck = z.infer<typeof ZDeck>;
