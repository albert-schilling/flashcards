# Handoff: flashcards from the lessons

Status (2026-11-11): idea and first plan only. Nothing built yet.

## Albert's request

> Can you create flashcards of the existing lessons?
>
> Ideas:
>
> - The flashcards should be created in German and English. English as default / as source and German as one translation under translations.
> - Every flashcard has an ID
> - Different types of flashcard:
>   - question / answer
>   - multiple choice
>   - ...
> - As JSONs with a schema, e.g. a Zod schema.
> - List (trusted) sources about the topic.
> - Add tags about the domain per flashcard (e.g. "Machine Learning" or "Mathematics")
> - Add tags about the topic (e.g. "Random Forest", "Decision Tree")
>
> My goal is to later create a very simple flashcard app to help memorize the content.

## Proposed plan

### What already exists to turn into cards

All in `teach/ai-modeling/`:

| Source | Count | Becomes |
| --- | --- | --- |
| Quiz questions in lessons 1–12 (`lessons/*.html`, `Quiz.mount(...)` blocks) | ~170 | `multiple_choice` cards, almost directly |
| `reference/formulas.html` (already English and German, with word formulas) | 63 | `formula` cards |
| `reference/glossary.html` (English term + German name) | 97 | `qa` (term) cards |

Total is about 330 cards. The drills create random numbers each time, so they don't fit as cards. A few fixed worked examples from them can become `numeric` cards.

### Schema (Zod)

Fields every card shares:

- `id`: stable, readable, never reused (e.g. `ml.trees.leaf-mean`)
- `version`: goes up when a card's text changes, so the app can restart its review
- `type`: picks the card type (Zod discriminated union on this field)
- `en`: the source text
- `translations.de`: the same fields, in German
- `tags.domain`: e.g. Machine Learning, Mathematics, Statistics, Python
- `tags.topic`: e.g. Random Forest, Decision Tree
- `sourceIds`: IDs from `sources.json`
- `lesson`: the lesson the card comes from

Card types:

| type | what the card stores |
| --- | --- |
| `qa` | question, answer |
| `multiple_choice` | options, the index of the right one, a short explanation |
| `formula` | the formula, the word formula, how to read it aloud, an example |
| `numeric` | question, answer, allowed error, unit |
| `cloze` | text with a gap to fill |
| `true_false` | statement, true or false |

With Zod 4, `z.toJSONSchema()` turns the schema into a JSON Schema. Then plain JSON files can be checked in an editor, in Python, or in CI.

### Sources and tags

- `sources.json`: each source has an ID, title, URL and kind (course repo, docs, book, paper). Cards refer to source IDs, so each URL is written once. The trusted sources are already listed in `teach/ai-modeling/RESOURCES.md` and in each lesson's footer.
- `tags.json`: one fixed list of allowed domain and topic tags, so near-duplicate tags can't creep in.

### Files

- `flashcards/` at the repo root, generated from the lessons, the same way the repo's CLAUDE.md treats `quizzes/`. Not inside `teach/`, because that folder belongs to the /teach skill.
- Planned contents: one JSON file per topic, plus `schema.ts`, `sources.json`, `tags.json`.
- Review progress (due date, ease) belongs in the app, not in the card files.

### Two traps

- **Math text:** store it as plain Unicode (`‖a‖ = √(a · a)`), with LaTeX as an optional extra field. Then the simplest app can show it without a math renderer.
- **Lesson text is HTML:** cards should hold plain text or Markdown.

## Open questions for Albert

1. Is the app TypeScript with Zod 4?
2. Should your own notes (`notes/concepts`) become cards too, or only the lessons and reference cards?
3. Do you want an Anki export as well?
4. Should cards be marked "shaky" from the re-test list (`teach/ai-modeling/NOTES.md`), so the app shows those first?
