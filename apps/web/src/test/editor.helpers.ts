// Opens the Card editor and a Card's preview in the App, fills and reads the editor's fields, and lists the Cards it creates.
import {
  fireEvent,
  screen,
  within,
  type BoundFunctions,
  type queries,
} from "@testing-library/react";
import { expect } from "vitest";
import { openCards } from "./app.helpers";

export function editor(title = "Create Card") {
  return within(screen.getByRole("dialog", { name: title }));
}

/** Opens the Cards page and the Card editor from Create Card in its heading, and returns queries inside the editor. */
export function openEditor() {
  openCards();
  fireEvent.click(screen.getByRole("button", { name: "Create Card" }));
  return editor();
}

export type TQueries = BoundFunctions<typeof queries>;

export function fill(dialog: TQueries, label: string, value: string) {
  fireEvent.change(dialog.getByLabelText(label), { target: { value } });
}

export function pickCardType(dialog: TQueries, type: string) {
  fireEvent.change(dialog.getByLabelText("Type"), { target: { value: type } });
}

/** Picks the option with this text in the select with this label. */
export function pickOption(dialog: TQueries, label: string, text: string) {
  const select = dialog.getByLabelText<HTMLSelectElement>(label);
  const option = [...select.options].find((option) => option.textContent === text)!;
  fireEvent.change(select, { target: { value: option.value } });
}

export function fieldValue(dialog: TQueries, label: string) {
  return dialog.getByLabelText<HTMLInputElement>(label).value;
}

/** Fills the fields every Card type shares, all but the ID. */
export function fillShared(dialog: TQueries) {
  fill(dialog, "Domain tags", "Machine Learning, Statistics");
  fill(dialog, "Topic tags", "Decision Tree");
  fill(dialog, "Lesson", "lesson-04");
}

/** On the Cards page, opens this Card's preview from its row and returns queries inside it. */
export function openPreview(id: string) {
  const remove = screen.getByRole("button", { name: `Delete ${id}` });
  const row = within(remove.closest("li")!)
    .getAllByRole("button")
    .find((button) => button !== remove)!;
  fireEvent.click(row);
  return within(screen.getByRole("dialog", { name: "Card preview" }));
}

export async function expectSaved() {
  expect((await screen.findByRole("status")).textContent).toBe("Card saved.");
}

export const created = [
  {
    type: "qa",
    fillType: (dialog: TQueries) => {
      fill(dialog, "Question", "What is the leaf mean?");
      fill(dialog, "Answer", "The mean of its targets.");
    },
    card: {
      id: "what-is-the-leaf-mean",
      type: "qa",
      en: { question: "What is the leaf mean?", answer: "The mean of its targets." },
    },
    answer: "The mean of its targets.",
  },
  {
    type: "cloze",
    fillType: (dialog: TQueries) => {
      pickCardType(dialog, "cloze");
      fill(dialog, "Text", "A leaf predicts the {{mean}}.");
    },
    card: {
      id: "a-leaf-predicts-the-mean",
      type: "cloze",
      en: { text: "A leaf predicts the {{mean}}." },
    },
    answer: "A leaf predicts the mean.",
  },
  {
    type: "true_false",
    fillType: (dialog: TQueries) => {
      pickCardType(dialog, "true_false");
      fill(dialog, "Statement", "A leaf is a node.");
      pickOption(dialog, "Answer", "False");
    },
    card: {
      id: "a-leaf-is-a-node",
      type: "true_false",
      en: { statement: "A leaf is a node." },
      answer: false,
    },
    answer: "False",
  },
  {
    type: "formula",
    fillType: (dialog: TQueries) => {
      pickCardType(dialog, "formula");
      fill(dialog, "Name", "Vector norm");
      fill(dialog, "Word formula", "The root of the summed squares.");
      fill(dialog, "Formula", "|x| = √(x₁² + x₂²)");
    },
    card: {
      id: "vector-norm",
      type: "formula",
      en: { name: "Vector norm", wordFormula: "The root of the summed squares." },
      formula: "|x| = √(x₁² + x₂²)",
    },
    answer: "|x| = √(x₁² + x₂²)",
  },
  {
    type: "numeric",
    fillType: (dialog: TQueries) => {
      pickCardType(dialog, "numeric");
      fill(dialog, "Question", "How far is it?");
      fill(dialog, "Answer", "5");
      fill(dialog, "Allowed error", "0.01");
      fill(dialog, "Unit", "m");
    },
    card: {
      id: "how-far-is-it",
      type: "numeric",
      en: { question: "How far is it?" },
      answer: 5,
      allowedError: 0.01,
      unit: "m",
    },
    answer: "5 m",
  },
  {
    type: "multiple_choice",
    fillType: (dialog: TQueries) => {
      pickCardType(dialog, "multiple_choice");
      fill(dialog, "Question", "Which node predicts?");
      fill(dialog, "Explanation", "A leaf predicts the mean.");
      fill(dialog, "Option 1", "The root");
      fill(dialog, "Option 2", "A leaf");
      fireEvent.click(dialog.getByLabelText("Option 2 is right"));
    },
    card: {
      id: "which-node-predicts",
      type: "multiple_choice",
      en: {
        question: "Which node predicts?",
        options: ["The root", "A leaf"],
        explanation: "A leaf predicts the mean.",
      },
      answerIndex: 1,
    },
    answer: "A leaf",
  },
];
