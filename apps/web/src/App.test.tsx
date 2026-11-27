import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "./App";
import {
  answer,
  blockStorage,
  deleteFromRow,
  download,
  expectListed,
  expectNoDialog,
  goHome,
  goTo,
  isCurrent,
  openCards,
  pick,
  startSession,
  upload,
  uploaded,
} from "./test/app.helpers";
import { fullFormula, german, multipleChoice, numeric, qa, tagged } from "./test/cards.fixtures";
import {
  created,
  editor,
  expectSaved,
  fieldValue,
  fill,
  fillShared,
  openEditor,
  openPreview,
  pickCardType,
} from "./test/editor.helpers";
import { home, overview } from "./test/statistics.helpers";
import {
  checkNumber,
  clickOption,
  expectFeedback,
  optionMarks,
  reveal,
} from "./test/study.helpers";

/** The labels of the editor's fields, in order. */
function fieldLabels(dialog: HTMLElement) {
  return [...dialog.querySelectorAll("label")].map((label) => label.textContent);
}

/** The error text under this field, from the elements that describe it; null when it has none. */
function fieldError(field: HTMLElement): string | null {
  const ids = field.getAttribute("aria-describedby")?.split(" ") ?? [];
  const error = ids
    .map((id) => document.getElementById(id))
    .find((element) => element?.classList.contains("field-error"));
  return error?.textContent ?? null;
}

/** The labels of the fields marked invalid, in order; each must show an error text. */
function invalidFields(dialog: HTMLElement) {
  return [...dialog.querySelectorAll<HTMLInputElement>('[aria-invalid="true"]')].map((field) => {
    expect(fieldError(field)).toBeTruthy();
    return field.labels![0].textContent;
  });
}

/** Opens this Card's preview on the Cards page and presses Edit there. */
function openEdit(id: string) {
  openCards();
  fireEvent.click(openPreview(id).getByRole("button", { name: "Edit" }));
  return editor("Edit Card");
}

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

it("the editor shows the picked type's fields, then its German fields, tags, Lesson and ID, and keeps what was typed across types", () => {
  render(<App />);
  const dialog = openEditor();
  const element = screen.getByRole("dialog", { name: "Create Card" });
  const shared = ["Domain tags", "Topic tags", "Lesson", "ID"];
  const select = dialog.getByLabelText<HTMLSelectElement>("Type");
  expect([...select.options].map((option) => option.value)).toEqual([
    "qa",
    "cloze",
    "true_false",
    "formula",
    "numeric",
    "multiple_choice",
  ]);
  expect(select.value).toBe("qa");
  expect(fieldLabels(element)).toEqual([
    "Type",
    "Question",
    "Answer",
    "Question (German)",
    "Answer (German)",
    ...shared,
  ]);
  fill(dialog, "Question", "What is the leaf mean?");

  pickCardType(dialog, "cloze");
  expect(fieldLabels(element)).toEqual(["Type", "Text", "Text (German)", ...shared]);
  pickCardType(dialog, "true_false");
  expect(fieldLabels(element)).toEqual([
    "Type",
    "Statement",
    "Answer",
    "Statement (German)",
    ...shared,
  ]);
  expect(dialog.getByLabelText("Answer").tagName).toBe("SELECT");
  fill(dialog, "Statement", "A leaf is a node.");
  pickCardType(dialog, "formula");
  expect(fieldLabels(element)).toEqual([
    "Type",
    "Name",
    "Word formula",
    "Read aloud",
    "Example",
    "Formula",
    "LaTeX",
    "Name (German)",
    "Word formula (German)",
    "Read aloud (German)",
    "Example (German)",
    ...shared,
  ]);
  fill(dialog, "Name", "Vector norm");
  fill(dialog, "Formula", "|x| = √(x₁² + x₂²)");
  pickCardType(dialog, "numeric");
  expect(fieldLabels(element)).toEqual([
    "Type",
    "Question",
    "Answer",
    "Allowed error",
    "Unit",
    "Question (German)",
    ...shared,
  ]);
  fill(dialog, "Answer", "9.81");
  pickCardType(dialog, "multiple_choice");
  expect(fieldLabels(element)).toEqual([
    "Type",
    "Question",
    "Explanation",
    "Option 1",
    "Option 1 (German)",
    "Option 2",
    "Option 2 (German)",
    "Question (German)",
    "Explanation (German)",
    ...shared,
  ]);
  expect(fieldValue(dialog, "Question")).toBe("What is the leaf mean?");
  pickCardType(dialog, "qa");

  expect(fieldValue(dialog, "Question")).toBe("What is the leaf mean?");
  pickCardType(dialog, "true_false");
  expect(fieldValue(dialog, "Statement")).toBe("A leaf is a node.");
  pickCardType(dialog, "formula");
  expect(fieldValue(dialog, "Name")).toBe("Vector norm");
  expect(fieldValue(dialog, "Formula")).toBe("|x| = √(x₁² + x₂²)");
  pickCardType(dialog, "numeric");
  expect(fieldValue(dialog, "Question")).toBe("What is the leaf mean?");
  expect(fieldValue(dialog, "Answer")).toBe("9.81");
});

it("the ID follows the question until the Learner types one", () => {
  render(<App />);
  const dialog = openEditor();
  expect(fieldValue(dialog, "ID")).toBe("");

  fill(dialog, "Question", "What is the leaf mean?");
  expect(fieldValue(dialog, "ID")).toBe("what-is-the-leaf-mean");
  fill(dialog, "Question", "How deep is a tree?");
  expect(fieldValue(dialog, "ID")).toBe("how-deep-is-a-tree");

  fill(dialog, "ID", "ml.trees.depth");
  fill(dialog, "Question", "How deep can a tree grow?");
  expect(fieldValue(dialog, "ID")).toBe("ml.trees.depth");
});

it("with no Cards, Home's Create Card opens the Card editor on the Cards page, only that once", async () => {
  render(<App />);

  fireEvent.click(home().getByRole("button", { name: "Create Card" }));

  expect(isCurrent("Cards")).toBe(true);
  fireEvent.click(editor().getByRole("button", { name: "Cancel" }));
  await expectNoDialog();
  goHome();
  openCards();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("Cancel closes the Card editor and stores nothing, also after a reload", async () => {
  const { unmount } = render(<App />);
  const dialog = openEditor();
  created[0].fillType(dialog);
  fillShared(dialog);

  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

  await expectNoDialog();
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
  expect(screen.queryByText("Card saved.")).toBeNull();
  unmount();
  render(<App />);
  // An empty list proves nothing before the reload finishes; "1 added" shows storage was empty.
  upload(qa("ml.trees.depth", 1));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);
  expect(screen.queryByText("what-is-the-leaf-mean")).toBeNull();
});

it("Create Card with empty fields marks each with its error after Save and stores nothing; fixing a field clears its error", async () => {
  render(<App />);
  const dialog = openEditor();
  const element = screen.getByRole("dialog", { name: "Create Card" });
  expect(invalidFields(element)).toEqual([]);

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(element)).toEqual([
    "Question",
    "Answer",
    "Domain tags",
    "Topic tags",
    "Lesson",
    "ID",
  ]);
  expect(screen.queryByText("Card saved.")).toBeNull();
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
  // The ID follows the question, so it is fixed too.
  fill(dialog, "Question", "What is the leaf mean?");
  expect(invalidFields(element)).toEqual(["Answer", "Domain tags", "Topic tags", "Lesson"]);
  expect(fieldError(dialog.getByLabelText("Question"))).toBeNull();
});

it("Create Card for a formula with empty fields marks Name, Word formula and Formula as empty, but not the optional fields", () => {
  render(<App />);
  const dialog = openEditor();
  const element = screen.getByRole("dialog", { name: "Create Card" });
  pickCardType(dialog, "formula");

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(element)).toEqual([
    "Name",
    "Word formula",
    "Formula",
    "Domain tags",
    "Topic tags",
    "Lesson",
    "ID",
  ]);
  for (const field of ["Name", "Word formula", "Formula"]) {
    expect(fieldError(dialog.getByLabelText(field))).toBe("This field can't be empty.");
  }
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
});

it("Create Card for a numeric Card marks a blank Answer as empty and a negative Allowed error as negative, but not the empty Unit", () => {
  render(<App />);
  const dialog = openEditor();
  const element = screen.getByRole("dialog", { name: "Create Card" });
  pickCardType(dialog, "numeric");
  fill(dialog, "Allowed error", "-0.5");

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(element)).toEqual([
    "Question",
    "Answer",
    "Allowed error",
    "Domain tags",
    "Topic tags",
    "Lesson",
    "ID",
  ]);
  expect(fieldError(dialog.getByLabelText("Answer"))).toBe("This field can't be empty.");
  expect(fieldError(dialog.getByLabelText("Allowed error"))).toBe(
    "The allowed error can't be negative.",
  );
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
});

it("Create Card for a multiple_choice Card marks blank options as empty, and blank German options once one is filled", () => {
  render(<App />);
  const dialog = openEditor();
  const element = screen.getByRole("dialog", { name: "Create Card" });
  pickCardType(dialog, "multiple_choice");
  fill(dialog, "Option 1 (German)", "Die Wurzel");

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(element)).toEqual([
    "Question",
    "Explanation",
    "Option 1",
    "Option 2",
    "Option 2 (German)",
    "Domain tags",
    "Topic tags",
    "Lesson",
    "ID",
  ]);
  for (const field of ["Option 1", "Option 2", "Option 2 (German)"]) {
    expect(fieldError(dialog.getByLabelText(field))).toBe("This field can't be empty.");
  }
  expect(fieldError(dialog.getByLabelText("Option 1 (German)"))).toBeNull();
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
});

it.each([
  { field: "Text", value: "A leaf predicts the mean." },
  { field: "Text (German)", value: "Ein Blatt sagt den Mittelwert voraus." },
])("Create Card shows an error under $field for a cloze without a gap", ({ field, value }) => {
  render(<App />);
  const dialog = openEditor();
  pickCardType(dialog, "cloze");
  fill(dialog, "Text", "A leaf predicts the {{mean}}.");
  fill(dialog, field, value);
  fillShared(dialog);

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(screen.getByRole("dialog", { name: "Create Card" }))).toEqual([field]);
});

it("Create Card with the ID of a stored Card shows Another Card has this ID. and keeps the stored Card", async () => {
  render(<App />);
  await uploaded(qa("ml.trees.depth", 1));
  const dialog = openEditor();
  created[0].fillType(dialog);
  fillShared(dialog);
  fill(dialog, "ID", "ml.trees.depth");

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(screen.getByRole("dialog", { name: "Create Card" }))).toEqual(["ID"]);
  expect(fieldError(dialog.getByLabelText("ID"))).toBe("Another Card has this ID.");
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  expect(openPreview("ml.trees.depth").getByText("An answer.")).toBeTruthy();
});

it("closes the Card editor before saving, so a failure shows in the page's error and nothing is stored", async () => {
  render(<App />);
  const dialog = openEditor();
  created[0].fillType(dialog);
  fillShared(dialog);
  blockStorage();

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("Card saved.")).toBeNull();
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
});

it("Card saved. and Card deleted. share one notice", async () => {
  render(<App />);
  await uploaded(qa("ml.trees.depth", 1));
  const dialog = openEditor();
  created[0].fillType(dialog);
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  deleteFromRow("ml.trees.depth");

  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Card deleted."));
  expect(screen.queryByText("Card saved.")).toBeNull();
});

const edited = german(
  tagged(qa("ml.trees.leaf-mean", 1), ["Machine Learning", "Statistics"], ["Decision Tree"]),
  {
    question: "Was ist ml.trees.leaf-mean?",
    answer: "Eine Antwort.",
  },
);

it("Edit in the preview opens the Card's fields with the ID disabled; Save changes raises the version, also after a reload", async () => {
  const { unmount } = render(<App />);
  await uploaded(edited);

  const dialog = openEdit("ml.trees.leaf-mean");

  expect(screen.queryByRole("dialog", { name: "Card preview" })).toBeNull();
  expect(fieldValue(dialog, "Type")).toBe("qa");
  expect(fieldValue(dialog, "Question")).toBe("What is ml.trees.leaf-mean?");
  expect(fieldValue(dialog, "Answer")).toBe("An answer.");
  expect(fieldValue(dialog, "Question (German)")).toBe("Was ist ml.trees.leaf-mean?");
  expect(fieldValue(dialog, "Answer (German)")).toBe("Eine Antwort.");
  expect(fieldValue(dialog, "Domain tags")).toBe("Machine Learning, Statistics");
  expect(fieldValue(dialog, "Topic tags")).toBe("Decision Tree");
  expect(fieldValue(dialog, "Lesson")).toBe("lesson-04");
  expect(fieldValue(dialog, "ID")).toBe("ml.trees.leaf-mean");
  expect(dialog.getByLabelText<HTMLInputElement>("ID").disabled).toBe(true);

  fill(dialog, "Answer", "The mean of its targets.");
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

  await expectSaved();
  const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
  expect(preview.getByText("ml.trees.leaf-mean · version 2")).toBeTruthy();
  expect(preview.getByText("The mean of its targets.")).toBeTruthy();
  unmount();
  render(<App />);
  await expectListed(edited);
  expect(
    openPreview("ml.trees.leaf-mean").getByText("ml.trees.leaf-mean · version 2"),
  ).toBeTruthy();
});

it("Save changes with nothing changed keeps the version", async () => {
  render(<App />);
  await uploaded(edited);
  const dialog = openEdit("ml.trees.leaf-mean");

  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

  await expectSaved();
  const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
  expect(preview.getByText("ml.trees.leaf-mean · version 1")).toBeTruthy();
});

it("Edit on a formula Card changes its Formula; Save changes raises the version and the preview shows the new formula", async () => {
  render(<App />);
  await uploaded(fullFormula("norm", 1));
  const dialog = openEdit("norm");
  expect(fieldValue(dialog, "Formula")).toBe("norm = a · b");
  expect(fieldValue(dialog, "LaTeX")).toBe("norm = a \\cdot b");

  fill(dialog, "Formula", "norm = b · a");
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

  await expectSaved();
  const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
  expect(preview.getByText("norm · version 2")).toBeTruthy();
  expect(preview.getByText("norm = b · a")).toBeTruthy();
  expect(preview.getByText("2 · 3 = 6")).toBeTruthy();
});

it("Edit on a numeric Card changes its Answer; Save changes raises the version and the preview shows the new answer with the unit", async () => {
  render(<App />);
  await uploaded(numeric("n", 1, "cm"));
  const dialog = openEdit("n");
  expect(fieldValue(dialog, "Answer")).toBe("5");
  expect(fieldValue(dialog, "Allowed error")).toBe("0.01");
  expect(fieldValue(dialog, "Unit")).toBe("cm");

  fill(dialog, "Answer", "7");
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

  await expectSaved();
  const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
  expect(preview.getByText("n · version 2")).toBeTruthy();
  expect(preview.getByText("7 cm")).toBeTruthy();
});

it("Edit on a multiple_choice Card with two options disables Remove until Add option; a third option marked right is saved as a new version", async () => {
  render(<App />);
  await uploaded(multipleChoice("mc", 1));
  const dialog = openEdit("mc");
  const removeButtons = () =>
    [1, 2].map(
      (n) => dialog.getByRole<HTMLButtonElement>("button", { name: `Remove option ${n}` }).disabled,
    );
  expect(fieldValue(dialog, "Option 1")).toBe("This");
  expect(fieldValue(dialog, "Option 2")).toBe("That");
  expect(removeButtons()).toEqual([true, true]);

  fireEvent.click(dialog.getByRole("button", { name: "Add option" }));

  expect(removeButtons()).toEqual([false, false]);
  expect(fieldValue(dialog, "Option 3")).toBe("");
  fill(dialog, "Option 3", "Neither");
  fireEvent.click(dialog.getByLabelText("Option 3 is right"));
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

  await expectSaved();
  const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
  expect(preview.getByText("mc · version 2")).toBeTruthy();
  expect(preview.getByText("Neither")).toBeTruthy();
});

it("after an edit, Statistics no longer count the Reviews of the Card's older version", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  startSession();
  await answer();
  goTo("Statistics");
  await screen.findByRole("table", { name: "Cards" });
  expect(overview()[1]).toEqual(["1", "Reviews"]);

  const dialog = openEdit("a");
  fill(dialog, "Answer", "Another answer.");
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
  await expectSaved();
  goTo("Statistics");

  await screen.findByRole("table", { name: "Cards" });
  expect(overview()).toEqual([
    ["1", "Cards"],
    ["0", "Reviews"],
    ["–", "Share right"],
  ]);
});
