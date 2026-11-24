import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CardEditor } from "./CardEditor";
import type { TEditableCard } from "./card.editor";
import { LanguageContext, type TLanguage } from "./language.context";
import { cloze, german, qa, trueFalse } from "./test/cards.fixtures";

/** Renders the editor for a new Card, or for `card`, and returns its callback mocks. */
function renderEditor(
  options: { card?: TEditableCard; takenIds?: string[]; language?: TLanguage } = {},
) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <LanguageContext.Provider value={options.language ?? "en"}>
      <CardEditor
        card={options.card}
        takenIds={options.takenIds ?? []}
        onSave={onSave}
        onClose={onClose}
      />
    </LanguageContext.Provider>,
  );
  return { onSave, onClose };
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(label, { exact: true });
}

function type(label: string, value: string) {
  fireEvent.change(field(label), { target: { value } });
}

/** The error shown for this field, through its aria-describedby; undefined when it has none. */
function errorOf(label: string): string | undefined {
  const control = field(label);
  const ids = control.getAttribute("aria-describedby")?.split(" ") ?? [];
  const error = ids
    .map((id) => document.getElementById(id))
    .find((element) => element?.classList.contains("field-error"));
  if (error) expect(control.getAttribute("aria-invalid")).toBe("true");
  else expect(control.getAttribute("aria-invalid")).toBeNull();
  return error?.textContent ?? undefined;
}

function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name, exact: true }));
}

/** Fills in a valid qa Card with ID ml.entropy. */
function fillQa() {
  type("Question", "What is entropy?");
  type("Answer", "A measure of disorder.");
  type("ID", "ml.entropy");
  type("Domain tags", "Machine Learning");
  type("Topic tags", "Decision Tree");
  type("Lesson", "lesson-04");
}

it("a new Card's editor is titled Create Card and starts as an empty qa Card", () => {
  renderEditor();

  const dialog = screen.getByRole("dialog", { name: "Create Card" });
  expect(field("Type").value).toBe("qa");
  expect(
    within(dialog)
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(["Question & answer", "Fill the gap", "True or false"]);
  for (const label of ["Question", "Answer", "ID", "Domain tags", "Topic tags", "Lesson"]) {
    expect(field(label).value).toBe("");
  }
  expect(field("Question in German (optional)").value).toBe("");
  expect(field("Answer in German (optional)").value).toBe("");
  expect(screen.getByRole("button", { name: "Create Card" })).toBeTruthy();
});

it("shows the fields of the picked type", () => {
  renderEditor();

  fireEvent.change(field("Type"), { target: { value: "cloze" } });
  expect(field("Text")).toBeTruthy();
  expect(field("Text in German (optional)")).toBeTruthy();
  expect(screen.queryByLabelText("Question")).toBeNull();

  fireEvent.change(field("Type"), { target: { value: "true_false" } });
  expect(field("Statement")).toBeTruthy();
  expect(field("Statement in German (optional)")).toBeTruthy();
  expect(field("Answer").value).toBe("true");
  expect(screen.queryByLabelText("Text")).toBeNull();
});

it("suggests the ID from the text until the Learner types one", () => {
  renderEditor();

  type("Question", "What is entropy?");
  expect(field("ID").value).toBe("what-is-entropy");

  type("ID", "ml.entropy");
  type("Question", "What is Gini impurity?");
  expect(field("ID").value).toBe("ml.entropy");
});

it("creates the Card with version 1, and Cancel closes", () => {
  const { onSave, onClose } = renderEditor();

  fillQa();
  type("Question in German (optional)", "Was ist Entropie?");
  click("Create Card");

  expect(onSave).toHaveBeenCalledWith({
    id: "ml.entropy",
    version: 1,
    tags: { domain: ["Machine Learning"], topic: ["Decision Tree"] },
    sourceIds: [],
    lesson: "lesson-04",
    type: "qa",
    en: { question: "What is entropy?", answer: "A measure of disorder." },
    translations: { de: { question: "Was ist Entropie?" } },
  } satisfies TCard);
  click("Cancel");
  expect(onClose).toHaveBeenCalledOnce();
});

it("shows no errors before the first Save, then each field's error, and saves nothing", () => {
  const { onSave } = renderEditor();

  expect(errorOf("Question")).toBeUndefined();
  click("Create Card");

  expect(onSave).not.toHaveBeenCalled();
  for (const label of ["Question", "Answer", "ID", "Domain tags", "Topic tags", "Lesson"]) {
    expect(errorOf(label)).toBe("Fill this in.");
  }
  expect(errorOf("Question in German (optional)")).toBeUndefined();
});

it("an error goes away once its field is fixed", () => {
  renderEditor();
  click("Create Card");

  type("Answer", "A measure of disorder.");

  expect(errorOf("Answer")).toBeUndefined();
  expect(errorOf("Question")).toBe("Fill this in.");
});

it("a cloze text without a gap, a badly formed ID and a taken ID show their errors", () => {
  const { onSave } = renderEditor({ takenIds: ["ml.entropy"] });
  fillQa();
  fireEvent.change(field("Type"), { target: { value: "cloze" } });
  type("Text", "Entropy measures disorder.");
  type("Text in German (optional)", "Entropie misst Unordnung.");
  click("Create Card");

  expect(errorOf("Text")).toBe("Mark at least one gap as {{gap}}.");
  expect(errorOf("Text in German (optional)")).toBe("Mark at least one gap as {{gap}}.");
  expect(errorOf("ID")).toBe("Another Card has this ID.");

  type("ID", "ML Entropy");
  expect(errorOf("ID")).toBe("Use lowercase words joined by dots or hyphens.");
  expect(onSave).not.toHaveBeenCalled();
});

it("shows the labels and errors in German", () => {
  renderEditor({ language: "de" });

  click("Karte erstellen");

  expect(screen.getByRole("dialog", { name: "Karte erstellen" })).toBeTruthy();
  expect(errorOf("Frage")).toBe("Bitte ausfüllen.");
  expect(errorOf("Antwort auf Deutsch (optional)")).toBeUndefined();
});

it("editing opens the Card's fields with its ID read-only, and Save changes raises the version", () => {
  const card = german(qa("ml.entropy", 2), { question: "Was ist Entropie?" });
  const { onSave } = renderEditor({ card, takenIds: ["ml.entropy"] });

  expect(screen.getByRole("dialog", { name: "Edit Card" })).toBeTruthy();
  expect(field("Question").value).toBe(card.en.question);
  expect(field("Answer").value).toBe(card.en.answer);
  expect(field("Question in German (optional)").value).toBe("Was ist Entropie?");
  expect(field("Domain tags").value).toBe("Machine Learning");
  expect(field("ID").value).toBe("ml.entropy");
  expect(field("ID").readOnly).toBe(true);

  type("Answer", "Disorder.");
  type("Question", "What does entropy measure?");
  click("Save changes");

  expect(field("ID").value).toBe("ml.entropy");
  expect(onSave).toHaveBeenCalledWith({
    ...card,
    version: 3,
    en: { question: "What does entropy measure?", answer: "Disorder." },
  });
});

it("editing a cloze or true_false Card opens its own fields", () => {
  renderEditor({ card: cloze("c", 1, "A {{gap}} here.") });
  expect(field("Text").value).toBe("A {{gap}} here.");
});

it("editing a false true_false Card shows False", () => {
  renderEditor({ card: trueFalse("t", 1, false) });
  expect(field("Statement").value).toBe("t is true.");
  expect(field("Answer").value).toBe("false");
});
