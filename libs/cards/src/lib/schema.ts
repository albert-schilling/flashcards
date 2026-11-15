import { z } from "zod";

const text = z.string().min(1);

const shared = {
  id: z.string().regex(/^[a-z0-9]+([.-][a-z0-9]+)*$/, "lowercase words joined by dots or hyphens"),
  version: z.int().min(1),
  tags: z.strictObject({
    domain: z.array(text).min(1),
    topic: z.array(text).min(1),
  }),
  sourceIds: z.array(text),
  lesson: text,
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

const multipleChoice = cardType(
  "multiple_choice",
  { question: text, options: z.array(text).min(2), explanation: text },
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

/** One Card. Text to show is in `en`; `translations.de`, if present, has the same fields in German, any of which may be missing and then falls back to English. */
export const cardSchema = z.discriminatedUnion("type", [
  cardType("qa", { question: text, answer: text }, {}),
  multipleChoice,
  cardType(
    "formula",
    { name: text, wordFormula: text, readAloud: text.optional(), example: text.optional() },
    { formula: text, latex: text.optional() },
  ),
  cardType(
    "numeric",
    { question: text },
    { answer: z.number(), allowedError: z.number().min(0), unit: text.optional() },
  ),
  cardType("cloze", { text: z.string().regex(/\{\{.+?\}\}/, "needs a {{gap}}") }, {}),
  cardType("true_false", { statement: text }, { answer: z.boolean() }),
]);

/** A Deck file: Cards with unique IDs. `$schema` lets an editor check the file against deck.schema.json. */
export const deckSchema = z
  .strictObject({
    $schema: z.string().optional(),
    cards: z.array(cardSchema),
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

export type Card = z.infer<typeof cardSchema>;
export type Deck = z.infer<typeof deckSchema>;
