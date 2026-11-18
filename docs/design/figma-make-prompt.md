# Figma Make prompt: Flashcards

Design a visual style and a clickable prototype for an existing web app called **Flashcards**. The app works today but has no styling at all: plain browser defaults. Keep its screens, flows, texts and features exactly as described below. Design how they look, don't add features. If you have ideas for new features, put them on a separate "Ideas" page, never in the main screens.

## The app

Flashcards helps one person, the Learner, memorize what they learned in AI modeling lessons: machine learning, statistics and mathematics. It runs in the browser only. There are no accounts, no server and no sync. Cards are stored in the browser, and the Learner moves them between devices by downloading and uploading JSON files.

The UI is in English and German; the Learner picks the language. German texts are often 30–40 % longer, so every layout must fit both. Show at least one screen in German.

## Look and feel

- Bright and light: white or near-white surfaces, plenty of air, one friendly accent color.
- Easy and friendly: soft rounded corners, clear big buttons, calm and encouraging feedback.
- Reputable and professional: a clean, readable type scale, restrained color, no cartoons, no confetti, nothing childish. It should feel like a serious study tool, close to a good note-taking app.
- Right and wrong feedback must not rely on color alone; add an icon or a word.
- Accessible: WCAG AA contrast, visible keyboard focus, touch targets at least 44 px.
- Mobile first (375 px wide), and also desktop (1280 px). The Learner often studies on a phone.
- Light mode is required. A dark mode is welcome as a second set of colors.
- Use one free Google Font (or two at most) and one open icon set, such as Lucide.

## Words

Use these terms exactly: Card, Deck, Session, Review, Review log, Statistics, Tag. Use the texts given below; they are final.

## Screens

The app has three screens. All of them show the title "Flashcards" at the top. An error message can appear under the title on any screen (for example "Storage is full").

### 1. Start page

The home screen. Lets the Learner manage Cards and start a Session. It has these parts, top to bottom (you may regroup them into clear sections or cards):

- **Language**: a select with "English" and "Deutsch".
- **Start a Session**:
  - "Cards": a number input, default 20 (how many Cards the Session has).
  - "Tag": a select with "Any tag" and the Tags of the stored Cards (for example "Machine Learning", "Decision Tree", "Statistics").
  - The "Start Session" button. It is the main action on the page and is disabled while there are no Cards.
- A "Statistics" button that opens screen 3.
- **Files**:
  - Two file uploads: "Upload Deck" and "Upload Review log".
  - Two downloads: "Download Cards" and "Download Review log".
  - A note under them: "Days since the last download: 3", or "No download yet". This reminds the Learner to back up; consider a gentle warning style when it is more than 7 days.
- **Upload result**, after an upload: "2 added, 1 updated, 0 unchanged" (Deck) or "5 added, 0 skipped" (Review log). If the file is rejected: "File rejected" and a list of details, such as "card 3: en.question: Required".
- **Card list**: one row per stored Card, such as "ml.trees.leaf-mean (qa, version 1)", each with a "Delete" button. Under the list, "Clear all", which asks "Delete all Cards?" first. The list can hold hundreds of Cards.
- **Empty state**: with no Cards yet, guide the Learner to upload a Deck.

### 2. Session

The Learner answers one Card at a time. A Card answered wrong comes back once, at the end. Show progress (for example "3 / 20"). Each Card type looks different:

- **qa**: a question, then "Reveal". After Reveal: the answer, and two buttons, "Knew it" and "Didn't know".
  Example: "What does a regression leaf predict?" → "The mean of its samples."
- **formula**: the formula's name and its description in words, then "Reveal". After Reveal: the formula and, optionally, an example; then "Knew it" and "Didn't know".
  Example: "Vector norm" / "The square root of a dot a." → "‖a‖ = √(a · a)". Formulas need a clear, slightly larger, math-friendly style.
- **cloze**: a sentence with a gap shown as "____", then "Reveal". After Reveal: the full sentence with the missing word highlighted; then "Knew it" and "Didn't know".
  Example: "A deeper tree has ____ variance." → "A deeper tree has **higher** variance."
- **multiple_choice**: a question and 2–5 options as buttons. A click answers. Then: "Right." or "Wrong.", "Answer: Mean squared error", an optional explanation, and "Next". Show the picked option and the right option clearly.
  Example: "Which criterion does a regression tree split on?" Options: "Gini impurity", "Mean squared error".
- **true_false**: a statement and two buttons, "True" and "False". Then the same feedback as multiple_choice.
- **numeric**: a question, a number input labelled "Answer" with an optional unit after it (such as "ms"), and "Check" (Enter also works). Then "Right." or "Wrong.", "Answer: 5", and "Next".
  Example: "What is the mean of 2, 4 and 9?"

At the end, a **summary**: "20 answered, 16 right", and a "Done" button that goes back to the start page.

Design each Card type before and after answering, and both "Right." and "Wrong.".

### 3. Statistics

A "Back" button and three tables:

- **Cards**: columns Card, Reviews, Share right, Last reviewed. Example row: "ml.trees.leaf-mean | 4 | 75% | 11/15/2026". A Card never reviewed shows "–" and "never".
- **Domain tags**: columns Tag, Cards, Reviews, Share right.
- **Topic tags**: the same columns.

Tables can be long and must work on a phone (for example, scroll inside the table or stack rows). A simple visual for "Share right", such as a small bar, is welcome, but the numbers must stay visible.

## German texts

Use these on the German screens:

| English                               | German                                               |
| ------------------------------------- | ---------------------------------------------------- |
| Language                              | Sprache                                              |
| Cards                                 | Karten                                               |
| Any tag                               | Alle Tags                                            |
| Start Session                         | Sitzung starten                                      |
| Statistics                            | Statistik                                            |
| Upload Deck                           | Deck hochladen                                       |
| Upload Review log                     | Lernprotokoll hochladen                              |
| Download Cards                        | Karten herunterladen                                 |
| Download Review log                   | Lernprotokoll herunterladen                          |
| Days since the last download: 3       | Tage seit dem letzten Herunterladen: 3               |
| No download yet                       | Noch nichts heruntergeladen                          |
| Delete / Clear all                    | Löschen / Alle löschen                               |
| Reveal                                | Aufdecken                                            |
| Knew it / Didn't know                 | Gewusst / Nicht gewusst                              |
| Right. / Wrong.                       | Richtig. / Falsch.                                   |
| Answer: …                             | Antwort: …                                           |
| Next / Check / Done / Back            | Weiter / Prüfen / Fertig / Zurück                    |
| True / False                          | Wahr / Falsch                                        |
| 20 answered, 16 right                 | 20 beantwortet, 16 richtig                           |
| Reviews / Share right / Last reviewed | Wiederholungen / Anteil richtig / Zuletzt wiederholt |
| Domain tags / Topic tags              | Fachgebiet-Tags / Themen-Tags                        |

## Technical notes

- The app is React 19 with plain CSS. Build the prototype with semantic HTML: real `<button>`, `<select>`, `<input>`, `<label>` and `<table>` elements, not divs styled as controls.
- Keep all texts as text, not images.
- Define every color, font size, spacing, radius and shadow as a named design token (CSS custom properties), and use only the tokens in the components.

## What to deliver

1. The clickable prototype covering every screen and state above.
2. A style guide page: color tokens (with hex values and where each is used), type scale (font, sizes, weights, line heights), spacing scale, radii, shadows, breakpoints and the icon set.
3. A component page with every state: buttons (primary, secondary, danger; default, hover, focus, disabled), inputs, selects, file upload, table, alert, the Card in each type, and the right and wrong feedback.
4. All tokens in one CSS file of custom properties.
