import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "./App";
import { answer, expectListed, goTo, openCards, startSession, uploaded } from "./test/app.helpers";
import { fullFormula, german, multipleChoice, numeric, qa, tagged } from "./test/cards.fixtures";
import { editor, expectSaved, fieldValue, fill, openPreview } from "./test/editor.helpers";
import { overview } from "./test/statistics.helpers";

/** Opens this Card's preview on the Cards page and presses Edit there. */
function openEdit(id: string) {
  openCards();
  fireEvent.click(openPreview(id).getByRole("button", { name: "Edit" }));
  return editor("Edit Card");
}

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
