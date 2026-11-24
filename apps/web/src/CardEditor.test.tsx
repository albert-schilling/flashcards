import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CardEditor } from "./CardEditor";
import { LanguageContext, type TLanguage } from "./language.context";
import { qa } from "./test/cards.fixtures";
import { uiText } from "./ui.text";

/** Renders the Card editor for this Card (none: a new one) with these stored Cards, and returns its onSave mock. */
function renderEditor(options: { card?: TCard; cards?: TCard[]; language?: TLanguage } = {}) {
  const onSave = vi.fn();
  render(
    <LanguageContext.Provider value={options.language ?? "en"}>
      <CardEditor
        card={options.card}
        cards={options.cards ?? []}
        onSave={onSave}
        onClose={() => {}}
      />
    </LanguageContext.Provider>,
  );
  return onSave;
}

function editor() {
  return within(screen.getByRole("dialog"));
}

/** The control of the editor field whose label starts with this text. A label may hold a hint after it, so it is matched by its first text. */
function control(name: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const label = [...screen.getByRole("dialog").querySelectorAll("label")].find(
    (each) => firstText(each) === name,
  );
  if (!label?.control) throw new Error(`No field labelled ${name}`);
  return label.control as HTMLInputElement;
}

function firstText(element: Element): string | undefined {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent!.trim();
    if (text) return text;
  }
  return undefined;
}

/** The labels of the editor's fields, in order. */
function fieldNames(): (string | undefined)[] {
  return [...screen.getByRole("dialog").querySelectorAll("label")].map(firstText);
}

function fill(name: string, value: string) {
  fireEvent.change(control(name), { target: { value } });
}

/** The error shown for this control: the text it is described by, when it is marked invalid. */
function errorOf(element: Element): string | undefined {
  if (element.getAttribute("aria-invalid") !== "true") return undefined;
  const ids = element.getAttribute("aria-describedby")?.split(" ") ?? [];
  const texts = ids.map((id) => document.getElementById(id)?.textContent ?? "");
  return (
    texts.find((text) => Object.values(uiText.en.fieldErrors).includes(text)) ??
    texts.find((text) => Object.values(uiText.de.fieldErrors).includes(text))
  );
}

function fieldError(name: string) {
  return errorOf(control(name));
}

/** The errors of every control marked invalid, in order. */
function shownErrors(): (string | undefined)[] {
  return [...screen.getByRole("dialog").querySelectorAll('[aria-invalid="true"]')].map(errorOf);
}

function save(name = "Create Card") {
  fireEvent.click(editor().getByRole("button", { name }));
}

/** Fills every field a qa Card needs, with the ID left to the suggestion. */
function fillQa() {
  fill("Question", "What is a leaf?");
  fill("Answer", "An end node.");
  fill("Lesson", "lesson-04");
  fill("Domain tags", "Machine Learning");
  fill("Topic tags", "Decision Tree");
}

it("is titled Create Card and offers Cancel and Create Card", () => {
  renderEditor();

  expect(screen.getByRole("dialog", { name: "Create Card" })).toBeTruthy();
  const buttons = editor()
    .getAllByRole("button")
    .map((button) => button.textContent);
  expect(buttons.slice(-2)).toEqual(["Cancel", "Create Card"]);
});

it("offers only the qa, cloze and true_false types, qa first", () => {
  renderEditor();

  const select = control("Type") as HTMLSelectElement;
  expect([...select.options].map((option) => option.textContent)).toEqual([
    "Question & answer",
    "Fill the gap",
    "True or false",
  ]);
  expect(select.value).toBe("qa");
});

it.each([
  {
    type: "qa",
    names: ["Question", "Answer", "Question (German, optional)", "Answer (German, optional)"],
  },
  { type: "cloze", names: ["Text", "Text (German, optional)"] },
  { type: "true_false", names: ["Statement", "Answer", "Statement (German, optional)"] },
])("a $type Card has its own fields, then the ID, lesson and tags", ({ type, names }) => {
  renderEditor();

  fireEvent.change(control("Type"), { target: { value: type } });

  const shown = fieldNames();
  for (const name of [...names, "Card ID", "Lesson", "Domain tags", "Topic tags"]) {
    expect(shown).toContain(name);
  }
  const others = ["Question", "Text", "Statement"].filter((name) => !names.includes(name));
  for (const name of others) expect(shown).not.toContain(name);
});

it("the true_false answer is True or False", () => {
  renderEditor();

  fireEvent.change(control("Type"), { target: { value: "true_false" } });

  const answer = control("Answer") as HTMLSelectElement;
  expect([...answer.options].map((option) => option.textContent)).toEqual(["True", "False"]);
});

it("the tag fields say to separate Tags with commas", () => {
  renderEditor();

  expect(editor().getAllByText("Separate Tags with commas.").length).toBeGreaterThan(0);
});

it("suggests the ID from the question until the Learner types an ID", () => {
  renderEditor();

  fill("Question", "What is a leaf?");
  expect(control("Card ID").value).toBe("what-is-a-leaf");

  fill("Card ID", "trees.leaf");
  fill("Question", "What is a leaf node?");
  expect(control("Card ID").value).toBe("trees.leaf");
});

it.each([
  { type: "cloze", field: "Text", text: "A {{leaf}} holds the mean.", id: "a-leaf-holds-the-mean" },
  {
    type: "true_false",
    field: "Statement",
    text: "Trees overfit easily.",
    id: "trees-overfit-easily",
  },
])("suggests the ID of a $type Card from its $field", ({ type, field, text, id }) => {
  renderEditor();

  fireEvent.change(control("Type"), { target: { value: type } });
  fill(field, text);

  expect(control("Card ID").value).toBe(id);
});

it("a new Type suggests the ID from its own field", () => {
  renderEditor();
  fill("Question", "What is a leaf?");

  fireEvent.change(control("Type"), { target: { value: "cloze" } });
  expect(control("Card ID").value).toBe("");
  fill("Text", "A {{leaf}} holds the mean.");

  expect(control("Card ID").value).toBe("a-leaf-holds-the-mean");
});

it("Create Card stays enabled, and with empty fields marks each one required and saves nothing", () => {
  const onSave = renderEditor();

  const create = editor().getByRole<HTMLButtonElement>("button", { name: "Create Card" });
  expect(create.disabled).toBe(false);
  save();

  const required = uiText.en.fieldErrors.required;
  for (const name of ["Question", "Answer", "Card ID", "Lesson", "Domain tags", "Topic tags"]) {
    expect(fieldError(name)).toBe(required);
  }
  expect(fieldError("Question (German, optional)")).toBeUndefined();
  expect(onSave).not.toHaveBeenCalled();
});

it("an ID not in the ID format shows a format error", () => {
  const onSave = renderEditor();
  fillQa();

  fill("Card ID", "What is a leaf");
  save();

  expect(shownErrors()).toEqual([uiText.en.fieldErrors.format]);
  expect(fieldError("Card ID")).toBe(uiText.en.fieldErrors.format);
  expect(onSave).not.toHaveBeenCalled();
});

it("a cloze text without a gap shows the gap error", () => {
  const onSave = renderEditor();
  fireEvent.change(control("Type"), { target: { value: "cloze" } });
  fill("Lesson", "lesson-04");
  fill("Domain tags", "Machine Learning");
  fill("Topic tags", "Decision Tree");

  fill("Text", "A leaf holds the mean.");
  save();

  expect(shownErrors()).toEqual([uiText.en.fieldErrors.gap]);
  expect(fieldError("Text")).toBe(uiText.en.fieldErrors.gap);
  expect(onSave).not.toHaveBeenCalled();
});

it("the ID of a stored Card shows the duplicate error", () => {
  const onSave = renderEditor({ cards: [qa("what-is-a-leaf", 1)] });
  fillQa();

  save();

  expect(shownErrors()).toEqual([uiText.en.fieldErrors.duplicate]);
  expect(fieldError("Card ID")).toBe(uiText.en.fieldErrors.duplicate);
  expect(onSave).not.toHaveBeenCalled();
});

it("each error code has its own text", () => {
  const texts = Object.values(uiText.en.fieldErrors);

  expect(Object.keys(uiText.en.fieldErrors).sort()).toEqual([
    "duplicate",
    "format",
    "gap",
    "required",
  ]);
  expect(new Set(texts).size).toBe(texts.length);
});

it("a fixed field loses its error on the next Save", () => {
  renderEditor();
  save();

  fillQa();
  fill("Card ID", "Bad ID");
  save();

  expect(fieldError("Question")).toBeUndefined();
  expect(fieldError("Card ID")).toBe(uiText.en.fieldErrors.format);
});

it("in German, the editor and its errors are German", () => {
  renderEditor({ language: "de" });

  expect(screen.getByRole("dialog", { name: "Karte erstellen" })).toBeTruthy();
  save("Karte erstellen");

  const errors = shownErrors();
  expect(errors.length).toBe(6);
  expect(new Set(errors)).toEqual(new Set([uiText.de.fieldErrors.required]));
  expect(uiText.de.fieldErrors.required).not.toBe(uiText.en.fieldErrors.required);
});

it("editing is titled Edit Card, shows the Card's fields, and keeps the ID and Type fixed", () => {
  renderEditor({ card: qa("a", 2), cards: [qa("a", 2)] });

  expect(screen.getByRole("dialog", { name: "Edit Card" })).toBeTruthy();
  expect(control("Question").value).toBe("What is a?");
  expect(control("Answer").value).toBe("An answer.");
  expect(control("Card ID").value).toBe("a");
  expect(control("Card ID").disabled).toBe(true);
  expect(control("Type").disabled).toBe(true);
  expect(editor().getByRole("button", { name: "Save changes" })).toBeTruthy();
  expect(editor().queryByRole("button", { name: "Create Card" })).toBeNull();
});

it("editing doesn't change the ID when the question changes", () => {
  renderEditor({ card: qa("a", 2), cards: [qa("a", 2)] });

  fill("Question", "What is a leaf?");

  expect(control("Card ID").value).toBe("a");
});
