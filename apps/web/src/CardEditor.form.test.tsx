import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  cloze,
  formula,
  fullFormula,
  german,
  multipleChoice,
  numeric,
  qa,
  trueFalse,
} from "./test/cards.fixtures";
import {
  confirmDelete,
  described,
  editorDialog,
  fillField,
  openCreate,
  openPreview,
  renderCardsPage,
  rowButton,
} from "./test/cards.page.helpers";

it("the heading holds Create Card with a hidden plus icon, which opens the Card editor", () => {
  renderCardsPage([qa("a", 1)]);
  const create = screen.getByRole("button", { name: "Create Card" });
  expect(create.closest(".cards-page-heading")).toBeTruthy();
  expect(create.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

  fireEvent.click(create);

  expect(screen.getByRole("dialog", { name: "Create Card" })).toBeTruthy();
});

it.each([
  qa("a", 1),
  cloze("a", 1),
  trueFalse("a", 1),
  formula("a", 1),
  numeric("a", 1),
  multipleChoice("a", 1),
])(
  "a $type preview ends with Delete, Edit, Add to current Session and New Session, each with a hidden icon",
  (card) => {
    renderCardsPage([card]);

    const buttons = openPreview("a").getAllByRole("button").slice(-4);

    expect(buttons.map((button) => button.textContent)).toEqual([
      "Delete",
      "Edit",
      "Add to current Session",
      "New Session",
    ]);
    for (const button of buttons) {
      expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
  },
);

it.each([
  {
    language: "en" as const,
    add: "Add to current Session",
    added: "Added to the current Session.",
    create: "New Session",
    created: "New Session created with this Card.",
  },
  {
    language: "de" as const,
    add: "Zur aktuellen Sitzung hinzufügen",
    added: "Zur aktuellen Sitzung hinzugefügt.",
    create: "Neue Sitzung",
    created: "Neue Sitzung mit dieser Karte erstellt.",
  },
])(
  "in $language, the preview's Add to current Session and New Session close it and show their notice",
  async ({ language, add, added, create, created }) => {
    renderCardsPage([qa("a", 1), qa("b", 1)], language);
    const preview = () =>
      within(screen.getByRole("dialog", { name: /^(Card preview|Kartenvorschau)$/ }));

    fireEvent.click(rowButton("a"));
    fireEvent.click(preview().getByRole("button", { name: add }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect((await screen.findByRole("status")).textContent).toBe(added);

    fireEvent.click(rowButton("b"));
    fireEvent.click(preview().getByRole("button", { name: create }));

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(created));
  },
);

it.each([
  {
    card: german(cloze("a", 1), { text: "a hat eine {{Lücke}}." }),
    fields: { Type: "cloze", Text: "a has a {{gap}}.", "Text (German)": "a hat eine {{Lücke}}." },
  },
  {
    card: german(trueFalse("a", 1, false), { statement: "a ist wahr." }),
    fields: { Type: "true_false", Statement: "a is true.", "Statement (German)": "a ist wahr." },
  },
  {
    card: fullFormula("a", 1),
    fields: {
      Type: "formula",
      Name: "The a formula",
      "Word formula": "a is a times b.",
      "Read aloud": "a equals a times b",
      Example: "2 · 3 = 6",
      Formula: "a = a · b",
      LaTeX: "a = a \\cdot b",
      "Name (German)": "Die a-Formel",
      "Word formula (German)": "a ist a mal b.",
      "Read aloud (German)": "a gleich a mal b",
      "Example (German)": "zwei mal drei",
    },
  },
  {
    card: german(numeric("a", 1, "m"), { question: "Wie viel ist a?" }),
    fields: {
      Type: "numeric",
      Question: "How much is a?",
      Answer: "5",
      "Allowed error": "0.01",
      Unit: "m",
      "Question (German)": "Wie viel ist a?",
    },
  },
  {
    card: german(multipleChoice("a", 1), {
      question: "Welches ist a?",
      options: ["Dies", "Das"],
      explanation: "Dieses.",
    }),
    fields: {
      Type: "multiple_choice",
      Question: "Which is a?",
      Explanation: "This one.",
      "Option 1": "This",
      "Option 1 (German)": "Dies",
      "Option 2": "That",
      "Option 2 (German)": "Das",
      "Question (German)": "Welches ist a?",
      "Explanation (German)": "Dieses.",
    },
  },
])("Edit in a $card.type preview opens the editor with the Card's fields", ({ card, fields }) => {
  renderCardsPage([card]);

  fireEvent.click(openPreview("a").getByRole("button", { name: "Edit" }));

  const editor = within(screen.getByRole("dialog", { name: "Edit Card" }));
  for (const [label, value] of Object.entries(fields)) {
    expect(editor.getByLabelText<HTMLInputElement>(label).value).toBe(value);
  }
  if (card.type === "true_false") {
    const answer = editor.getByLabelText<HTMLSelectElement>("Answer");
    expect(answer.selectedOptions[0].textContent).toBe("False");
  }
  if (card.type === "multiple_choice") {
    expect(editor.getByLabelText<HTMLInputElement>("Option 1 is right").checked).toBe(true);
    expect(editor.getByLabelText<HTMLInputElement>("Option 2 is right").checked).toBe(false);
  }
  expect(editor.getByRole("button", { name: "Save changes" })).toBeTruthy();
});

it.each<[string, () => void]>([
  ["Close", () => fireEvent.click(within(editorDialog()).getByRole("button", { name: "Close" }))],
  ["Escape", () => fireEvent.keyDown(editorDialog(), { key: "Escape" })],
  ["a mouse-down on the backdrop", () => fireEvent.mouseDown(editorDialog().parentElement!)],
])("%s closes the Card editor and saves nothing", (_, close) => {
  const { onSave } = renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fillField(editor, "Question", "What is b?");

  close();

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onSave).not.toHaveBeenCalled();
});

it("after an Edit is cancelled, Create Card opens an empty editor whose ID follows the question", () => {
  renderCardsPage([german(qa("a", 1), { question: "Was ist a?" })]);
  fireEvent.click(openPreview("a").getByRole("button", { name: "Edit" }));
  fireEvent.click(within(editorDialog("Edit Card")).getByRole("button", { name: "Cancel" }));

  const editor = openCreate();

  expect(editor.getByLabelText<HTMLTextAreaElement>("Question").value).toBe("");
  expect(editor.getByLabelText<HTMLTextAreaElement>("Question (German)").value).toBe("");
  expect(editor.getByLabelText<HTMLInputElement>("Lesson").value).toBe("");
  const id = editor.getByLabelText<HTMLInputElement>("ID");
  expect(id.disabled).toBe(false);
  fillField(editor, "Question", "What is b?");
  expect(id.value).toBe("what-is-b");
});

it("each field problem shows its own text: an empty field, a cloze without a gap, an ID that is not lowercase words", () => {
  const { onSave } = renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "cloze" } });
  fillField(editor, "Text", "A leaf predicts the mean.");
  fillField(editor, "Domain tags", "Machine Learning");
  fillField(editor, "Topic tags", "Decision Tree");
  fillField(editor, "ID", "Bad ID");

  fireEvent.click(editor.getByRole("button", { name: "Create Card" }));

  expect(described(editor.getByLabelText("Text")).at(-1)).toBe(
    "Add a gap in double braces, like {{gap}}.",
  );
  expect(described(editor.getByLabelText("Lesson"))).toEqual(["This field can't be empty."]);
  expect(described(editor.getByLabelText("ID")).at(-1)).toBe(
    "Use lowercase words joined by dots or hyphens.",
  );
  expect(onSave).not.toHaveBeenCalled();
});

it("in German, the Card editor, its errors and the saved notice read in German", async () => {
  const { onSave } = renderCardsPage([qa("a", 1)], "de");
  const editor = openCreate("Karte erstellen");
  const labels = [...editorDialog("Karte erstellen").querySelectorAll("label")].map(
    (label) => label.textContent,
  );
  expect(labels).toEqual([
    "Typ",
    "Frage",
    "Antwort",
    "Frage (Deutsch)",
    "Antwort (Deutsch)",
    "Fachgebiet-Tags",
    "Themen-Tags",
    "Lektion",
    "ID",
  ]);

  fireEvent.click(editor.getByRole("button", { name: "Karte erstellen" }));
  expect(described(editor.getByLabelText("Lektion"))).toEqual([
    "Dieses Feld darf nicht leer sein.",
  ]);

  fillField(editor, "Frage", "What is b?");
  fillField(editor, "Antwort", "B.");
  fillField(editor, "Fachgebiet-Tags", "Machine Learning");
  fillField(editor, "Themen-Tags", "Decision Tree");
  fillField(editor, "Lektion", "lesson-04");
  fireEvent.click(editor.getByRole("button", { name: "Karte erstellen" }));

  expect((await screen.findByRole("status")).textContent).toBe("Karte gespeichert.");
  expect(onSave).toHaveBeenCalledTimes(1);
});

it("a failed save after a deleted Card removes Card deleted. and opens no preview", async () => {
  const { onSave } = renderCardsPage([qa("a", 1), qa("b", 1)]);
  onSave.mockResolvedValue(false);
  confirmDelete("a");
  await screen.findByRole("status");
  const editor = openCreate();
  fillField(editor, "Question", "What is c?");
  fillField(editor, "Answer", "C.");
  fillField(editor, "Domain tags", "Machine Learning");
  fillField(editor, "Topic tags", "Decision Tree");
  fillField(editor, "Lesson", "lesson-04");

  fireEvent.click(editor.getByRole("button", { name: "Create Card" }));
  // Let the page handle onSave's result before looking.
  await act(async () => {});

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});
