import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CardEditor } from "./CardEditor";
import { LanguageContext, type TLanguage } from "./language.context";
import { cloze, german, qa, trueFalse } from "./test/cards.fixtures";

/** Renders the Card editor, for `card` if given, and returns its onSave mock. */
function renderEditor(
  card?: Parameters<typeof CardEditor>[0]["card"],
  takenIds: string[] = [],
  language: TLanguage = "en",
) {
  const onSave = vi.fn();
  render(
    <LanguageContext.Provider value={language}>
      <CardEditor card={card} takenIds={takenIds} onSave={onSave} onClose={vi.fn()} />
    </LanguageContext.Provider>,
  );
  return onSave;
}

function field(label: string) {
  return screen.getByLabelText<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(label, {
    exact: true,
  });
}

function type(label: string, value: string) {
  fireEvent.change(field(label), { target: { value } });
}

function fillShared() {
  type("Lesson", "lesson-04");
  type("Domain tags", "Machine Learning");
  type("Topic tags", "Decision Tree, Variance");
}

/** The labels of the editor's fields, in order. */
function labels(): string[] {
  return Array.from(document.querySelectorAll(".editor-form label")).map(
    (label) => label.textContent!,
  );
}

/** The error shown for this field; undefined when there is none. */
function errorOf(label: string): string | undefined {
  const control = field(label);
  if (control.getAttribute("aria-invalid") !== "true") return undefined;
  const ids = control.getAttribute("aria-describedby")!.split(" ");
  return ids
    .map((id) => document.getElementById(id)!)
    .find((hint) => hint.className === "field-error")?.textContent;
}

it.each([
  {
    type: "qa",
    fields: ["Question", "Answer", "Question in German (optional)", "Answer in German (optional)"],
  },
  { type: "cloze", fields: ["Text", "Text in German (optional)"] },
  { type: "true_false", fields: ["Statement", "Answer", "Statement in German (optional)"] },
])("for $type, shows the Type, its fields, then ID, lesson and tags", ({ type, fields }) => {
  renderEditor();

  fireEvent.change(field("Type"), { target: { value: type } });

  expect(labels()).toEqual(["Type", ...fields, "ID", "Lesson", "Domain tags", "Topic tags"]);
});

it("offers only qa, cloze and true_false", () => {
  renderEditor();

  const options = Array.from((field("Type") as HTMLSelectElement).options).map((o) => o.text);

  expect(options).toEqual(["Question & answer", "Fill the gap", "True or false"]);
});

it("is titled Create Card, suggests the ID from the text, and saves a version 1 Card", () => {
  const onSave = renderEditor();
  expect(screen.getByRole("dialog", { name: "Create Card" })).toBeTruthy();

  type("Question", "What does a leaf predict?");
  type("Answer", "The mean.");
  type("Answer in German (optional)", "Den Mittelwert.");
  fillShared();
  expect(field("ID").value).toBe("what-does-a-leaf-predict");
  fireEvent.click(screen.getByRole("button", { name: "Create Card" }));

  expect(onSave).toHaveBeenCalledWith({
    id: "what-does-a-leaf-predict",
    version: 1,
    tags: { domain: ["Machine Learning"], topic: ["Decision Tree", "Variance"] },
    sourceIds: [],
    lesson: "lesson-04",
    type: "qa",
    en: { question: "What does a leaf predict?", answer: "The mean." },
    translations: { de: { answer: "Den Mittelwert." } },
  });
});

it("a typed ID stays when the text changes", () => {
  renderEditor();

  type("Question", "First");
  type("ID", "my.card");
  type("Question", "Second");

  expect(field("ID").value).toBe("my.card");
});

it("saves a true_false Card with the picked answer", () => {
  const onSave = renderEditor();

  type("Type", "true_false");
  type("Statement", "Trees split.");
  type("Answer", "false");
  fillShared();
  fireEvent.click(screen.getByRole("button", { name: "Create Card" }));

  expect(onSave.mock.calls[0][0]).toMatchObject({ type: "true_false", answer: false });
});

it("shows field errors and saves nothing: empty fields, a cloze without a gap, a duplicate ID", () => {
  const onSave = renderEditor(undefined, ["taken"]);

  type("Type", "cloze");
  type("Text", "No gap here.");
  type("ID", "taken");
  fireEvent.click(screen.getByRole("button", { name: "Create Card" }));

  expect(onSave).not.toHaveBeenCalled();
  expect(errorOf("Text")).toBe("Add a gap in double braces, like {{gap}}.");
  expect(errorOf("ID")).toBe("Another Card has this ID.");
  expect(errorOf("Lesson")).toBe("Fill in this field.");
  expect(errorOf("Domain tags")).toBe("Fill in this field.");
  expect(errorOf("Topic tags")).toBe("Fill in this field.");
  expect(errorOf("Text in German (optional)")).toBeUndefined();
});

it("shows field errors in German", () => {
  renderEditor(undefined, [], "de");

  fireEvent.click(screen.getByRole("button", { name: "Karte erstellen" }));

  expect(errorOf("Frage")).toBe("Füll dieses Feld aus.");
});

it.each<{ card: Parameters<typeof CardEditor>[0]["card"] & TCard; values: Record<string, string> }>(
  [
    {
      card: german(qa("a", 2), { question: "Was ist a?" }),
      values: {
        Question: "What is a?",
        Answer: "An answer.",
        "Question in German (optional)": "Was ist a?",
      },
    },
    { card: cloze("b", 1), values: { Text: "b has a {{gap}}." } },
    { card: trueFalse("c", 1, false), values: { Statement: "c is true.", Answer: "false" } },
  ],
)("edits a $card.type Card: its fields filled in, the ID fixed", ({ card, values }) => {
  renderEditor(card, [card.id]);

  expect(screen.getByRole("dialog", { name: "Edit Card" })).toBeTruthy();
  expect(field("Type").value).toBe(card.type);
  for (const [label, value] of Object.entries(values)) expect(field(label).value).toBe(value);
  expect(field("ID").value).toBe(card.id);
  expect(field("ID").disabled).toBe(true);
  expect(field("Domain tags").value).toBe("Machine Learning");
});

it("Save changes raises the version of an edited Card", () => {
  const onSave = renderEditor(qa("a", 2), ["a"]);

  type("Answer", "A new answer.");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(onSave).toHaveBeenCalledWith({
    ...qa("a", 3),
    en: { question: "What is a?", answer: "A new answer." },
  });
});
