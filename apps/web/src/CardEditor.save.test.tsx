import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "./App";
import { download, expectListed, goHome, pick, startSession } from "./test/app.helpers";
import {
  created,
  expectSaved,
  fieldValue,
  fill,
  fillShared,
  openEditor,
  pickCardType,
} from "./test/editor.helpers";
import {
  checkNumber,
  clickOption,
  expectFeedback,
  optionMarks,
  reveal,
} from "./test/study.helpers";

it.each(created)(
  "Create Card on the Cards page makes a $type Card, shows Card saved. and its preview, and keeps it after a reload",
  async ({ fillType, card, answer }) => {
    const { unmount } = render(<App />);
    const dialog = openEditor();
    fillType(dialog);
    fillShared(dialog);

    fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

    await expectSaved();
    const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
    expect(preview.getByText(`${card.id} · version 1`)).toBeTruthy();
    expect(preview.getByText(answer)).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Create Card" })).toBeNull();
    fireEvent.click(preview.getByRole("button", { name: "Close" }));
    await screen.findByText(card.id);
    unmount();
    render(<App />);
    await expectListed(card as TCard);
  },
);

it("a created Card is in Download Cards like an uploaded one, and the file uploads again unchanged", async () => {
  render(<App />);
  const dialog = openEditor();
  created[0].fillType(dialog);
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  const file = await download("Download Cards");

  expect(JSON.parse(await file.text()).cards).toEqual([
    {
      id: "what-is-the-leaf-mean",
      version: 1,
      tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      type: "qa",
      en: { question: "What is the leaf mean?", answer: "The mean of its targets." },
    },
  ]);
  pick(file, "Upload Deck");
  await screen.findByText(/0 added, 0 updated, 1 unchanged/);
});

it("a formula Card created with every field has them all in Download Cards: the texts in English and German, Formula and LaTeX once", async () => {
  render(<App />);
  const dialog = openEditor();
  created[3].fillType(dialog);
  fill(dialog, "Read aloud", "norm of x");
  fill(dialog, "Example", "|(3, 4)| = 5");
  fill(dialog, "LaTeX", "\\lVert x \\rVert");
  fill(dialog, "Name (German)", "Vektornorm");
  fill(dialog, "Word formula (German)", "Die Wurzel der summierten Quadrate.");
  fill(dialog, "Read aloud (German)", "Norm von x");
  fill(dialog, "Example (German)", "|(3, 4)| ist 5");
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  const file = await download("Download Cards");

  expect(JSON.parse(await file.text()).cards).toEqual([
    {
      id: "vector-norm",
      version: 1,
      tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      type: "formula",
      en: {
        name: "Vector norm",
        wordFormula: "The root of the summed squares.",
        readAloud: "norm of x",
        example: "|(3, 4)| = 5",
      },
      translations: {
        de: {
          name: "Vektornorm",
          wordFormula: "Die Wurzel der summierten Quadrate.",
          readAloud: "Norm von x",
          example: "|(3, 4)| ist 5",
        },
      },
      formula: "|x| = √(x₁² + x₂²)",
      latex: "\\lVert x \\rVert",
    },
  ]);
});

it("a formula Card created with an example reveals its formula and example in a Session", async () => {
  render(<App />);
  const dialog = openEditor();
  created[3].fillType(dialog);
  fill(dialog, "Example", "|(3, 4)| = 5");
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  goHome();
  startSession();
  const article = await screen.findByRole("article");

  reveal(article);

  expect(article.querySelector(".revealed-answer .formula")?.textContent).toBe(
    "|x| = √(x₁² + x₂²)",
  );
  expect(article.querySelector(".revealed-answer .example")?.textContent).toBe(
    "Example: |(3, 4)| = 5",
  );
});

it.each([
  { typed: "5", word: "Right.", right: true },
  { typed: "6", word: "Wrong.", right: false },
])(
  "a numeric Card created with Answer 5 and Allowed error 0.01 counts $typed as $word in a Session",
  async ({ typed, word, right }) => {
    render(<App />);
    const dialog = openEditor();
    created[4].fillType(dialog);
    fillShared(dialog);
    fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
    await expectSaved();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    goHome();
    startSession();
    const article = await screen.findByRole("article");

    checkNumber(article, typed);

    expectFeedback(article, word, right);
  },
);

it("a multiple_choice Card created with Option 2 marked right marks it right in a Session", async () => {
  render(<App />);
  const dialog = openEditor();
  created[5].fillType(dialog);
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  goHome();
  startSession();
  const article = await screen.findByRole("article");

  clickOption(article, "A leaf");

  expect(optionMarks(article)).toEqual(["A", "correct check"]);
  expectFeedback(article, "Right.", true);
});

it("a multiple_choice Card made with three options in English and German, the third marked right and the first removed, has the other two in Download Cards with the third still right", async () => {
  render(<App />);
  const dialog = openEditor();
  pickCardType(dialog, "multiple_choice");
  fill(dialog, "Question", "Which node predicts?");
  fill(dialog, "Explanation", "A leaf predicts the mean.");
  fill(dialog, "Question (German)", "Welcher Knoten sagt voraus?");
  fill(dialog, "Explanation (German)", "Ein Blatt sagt den Mittelwert voraus.");
  fill(dialog, "Option 1", "The root");
  fill(dialog, "Option 1 (German)", "Die Wurzel");
  fill(dialog, "Option 2", "A split");
  fill(dialog, "Option 2 (German)", "Ein Split");
  fireEvent.click(dialog.getByRole("button", { name: "Add option" }));
  fill(dialog, "Option 3", "A leaf");
  fill(dialog, "Option 3 (German)", "Ein Blatt");
  fireEvent.click(dialog.getByLabelText("Option 3 is right"));

  fireEvent.click(dialog.getByRole("button", { name: "Remove option 1" }));

  expect(dialog.queryByLabelText("Option 3")).toBeNull();
  expect(fieldValue(dialog, "Option 1")).toBe("A split");
  expect(fieldValue(dialog, "Option 2")).toBe("A leaf");
  expect(fieldValue(dialog, "Option 2 (German)")).toBe("Ein Blatt");
  expect(dialog.getByLabelText<HTMLInputElement>("Option 2 is right").checked).toBe(true);
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  const file = await download("Download Cards");
  expect(JSON.parse(await file.text()).cards).toEqual([
    {
      id: "which-node-predicts",
      version: 1,
      tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      type: "multiple_choice",
      en: {
        question: "Which node predicts?",
        options: ["A split", "A leaf"],
        explanation: "A leaf predicts the mean.",
      },
      translations: {
        de: {
          question: "Welcher Knoten sagt voraus?",
          options: ["Ein Split", "Ein Blatt"],
          explanation: "Ein Blatt sagt den Mittelwert voraus.",
        },
      },
      answerIndex: 1,
    },
  ]);
});
