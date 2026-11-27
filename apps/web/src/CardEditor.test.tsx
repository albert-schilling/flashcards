import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import {
  blockStorage,
  deleteFromRow,
  expectNoDialog,
  goHome,
  isCurrent,
  openCards,
  upload,
  uploaded,
} from "./test/app.helpers";
import { qa } from "./test/cards.fixtures";
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
import { home } from "./test/statistics.helpers";

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

describe("validation", () => {
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
