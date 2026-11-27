import { fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";
import { qa } from "./test/cards.fixtures";
import { described, fillField, openCreate, renderCardsPage } from "./test/cards.page.helpers";

it("the editor's fields show their hints and tag placeholders, and an error follows the hint", () => {
  renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "cloze" } });
  const domain = editor.getByLabelText<HTMLInputElement>("Domain tags");
  const topic = editor.getByLabelText<HTMLInputElement>("Topic tags");

  expect(described(editor.getByLabelText("Text"))).toEqual([
    "Put each gap in double braces, like {{gap}}.",
  ]);
  expect(described(editor.getByLabelText("Text (German)"))).toEqual([
    "Optional. Without it, the English text shows.",
  ]);
  expect(described(domain)).toEqual(["Separate Tags with commas."]);
  expect(described(topic)).toEqual(["Separate Tags with commas."]);
  expect(domain.placeholder).toBe("Machine Learning");
  expect(topic.placeholder).toBe("Decision Tree");
  expect(described(editor.getByLabelText("Lesson"))).toEqual([]);
  expect(described(editor.getByLabelText("ID"))).toEqual([
    "Lowercase words joined by dots or hyphens.",
  ]);

  fillField(editor, "Text", "A leaf predicts the mean.");
  fireEvent.click(editor.getByRole("button", { name: "Create Card" }));

  expect(described(editor.getByLabelText("Text"))).toEqual([
    "Put each gap in double braces, like {{gap}}.",
    "Add a gap in double braces, like {{gap}}.",
  ]);
});

it("the formula fields are text areas with the control style; Read aloud, Example and LaTeX say they are optional", () => {
  renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "formula" } });
  const germanHint = ["Optional. Without it, the English text shows."];
  const hints = {
    Name: [],
    "Word formula": [],
    "Read aloud": ["Optional."],
    Example: ["Optional."],
    Formula: [],
    LaTeX: ["Optional."],
    "Name (German)": germanHint,
    "Word formula (German)": germanHint,
    "Read aloud (German)": germanHint,
    "Example (German)": germanHint,
  };

  for (const [label, hint] of Object.entries(hints)) {
    const field = editor.getByLabelText(label);
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.classList.contains("control")).toBe(true);
    expect(field.closest(".field")).toBeTruthy();
    expect(described(field)).toEqual(hint);
  }
});

it("the numeric fields have the control style: Answer and Allowed error are number inputs without a hint, Allowed error starts at 0, and Unit is a text input that says it is optional", () => {
  renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "numeric" } });
  const fields = {
    Answer: { type: "number", hint: [] },
    "Allowed error": { type: "number", hint: [] },
    Unit: { type: "text", hint: ["Optional."] },
  };

  for (const [label, { type, hint }] of Object.entries(fields)) {
    const field = editor.getByLabelText<HTMLInputElement>(label);
    expect(field.tagName).toBe("INPUT");
    expect(field.type).toBe(type);
    expect(field.getAttribute("step")).toBe(type === "number" ? "any" : null);
    expect(field.classList.contains("control")).toBe(true);
    expect(field.closest(".field")).toBeTruthy();
    expect(described(field)).toEqual(hint);
  }
  expect(editor.getByLabelText<HTMLInputElement>("Answer").value).toBe("");
  expect(editor.getByLabelText<HTMLInputElement>("Allowed error").value).toBe("0");
  expect(described(editor.getByLabelText("Question (German)"))).toEqual([
    "Optional. Without it, the English text shows.",
  ]);
});

it("the multiple_choice options are one-line inputs with the control style and no hint of their own, under the Options fieldset's one hint; Remove is an icon button titled like its name", () => {
  renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "multiple_choice" } });
  const fieldset = editor.getByRole("group", { name: "Options" });

  expect(described(fieldset)).toEqual(["Mark the right option. German options: fill all or none."]);
  for (const label of ["Option 1", "Option 1 (German)", "Option 2", "Option 2 (German)"]) {
    const field = editor.getByLabelText<HTMLInputElement>(label);
    expect(field.tagName).toBe("INPUT");
    expect(field.type).toBe("text");
    expect(field.classList.contains("control")).toBe(true);
    expect(field.closest(".field")).toBeTruthy();
    expect(described(field)).toEqual([]);
  }
  expect(editor.getByLabelText("Explanation").tagName).toBe("TEXTAREA");
  const remove = editor.getByRole("button", { name: "Remove option 2" });
  expect(remove.classList.contains("icon-button")).toBe(true);
  expect(remove.title).toBe("Remove option 2");
});

it("an option marked right stays marked while option texts are typed and an option is added", () => {
  renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "multiple_choice" } });
  const right = (n: number) => editor.getByLabelText<HTMLInputElement>(`Option ${n} is right`);
  fireEvent.click(right(2));

  fillField(editor, "Option 1", "The root");
  fillField(editor, "Option 2 (German)", "Ein Blatt");
  fireEvent.click(editor.getByRole("button", { name: "Add option" }));

  expect([1, 2, 3].map((n) => right(n).checked)).toEqual([false, true, false]);
});

it("in German, the Options fieldset, its rows and buttons read in German", () => {
  renderCardsPage([qa("a", 1)], "de");
  const editor = openCreate("Karte erstellen");
  fireEvent.change(editor.getByLabelText("Typ"), { target: { value: "multiple_choice" } });

  expect(described(editor.getByRole("group", { name: "Optionen" }))).toEqual([
    "Markiere die richtige Option. Deutsche Optionen: alle oder keine.",
  ]);
  expect(editor.getByLabelText("Erklärung")).toBeTruthy();
  expect(editor.getByLabelText("Option 1 (Deutsch)")).toBeTruthy();
  expect(editor.getByLabelText("Option 1 ist richtig")).toBeTruthy();
  expect(editor.getByRole("button", { name: "Option 1 entfernen" })).toBeTruthy();
  expect(editor.getByRole("button", { name: "Option hinzufügen" })).toBeTruthy();
});
