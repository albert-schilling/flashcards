# Code and config

- Comments say the reason in words. They never cite a decision by number alone ("Q38"), which a later reader can't look up; name the document if a source is needed.
- Config files stay close to tool defaults; each deviation gets a one-line comment saying why.
- Zod schemas are PascalCase with a `Z` prefix, types and interfaces with a `T` prefix, most general word first: `ZCardQA` and `TCardQA`, `ZDeck` and `TDeck`. No lint rule enforces it (oxlint has none); review does.
- File names: React components are `PascalCase.tsx` (`Session.tsx`); other modules are lowercase with a dot suffix for their purpose (`session.helper.ts`, `card.schemas.ts`, `review.storage.ts`). A test file adds `.test` before the extension (`session.helper.test.ts`) and sits next to the code it tests.
- Follow the patterns of the code nearby before you introduce a new one; when you introduce one, say why in the pull request.
- Styles use only the design tokens (`apps/web/src/tokens.css`, a copy of `docs/design/tokens.css`); `styles.test.ts` checks it. Allowed raw values, none of them a colour or a size: `0`, `100%`, `100vh`, `-1` in `calc`, the commented breakpoint, integer `z-index`, `color-mix` percentages, and `fr` fractions such as `repeat(2, 1fr)`. A prototype rule with any other raw value is left out with a comment.
