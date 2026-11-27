import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import {
  alertIcon,
  blockStorage,
  deleteAllButton,
  deleteFromRow,
  expectListed,
  expectNoDialog,
  expectNotListed,
  goHome,
  openCards,
  openDeleteAll,
  upload,
  uploaded,
} from "./test/app.helpers";
import { qa } from "./test/cards.fixtures";
import { home } from "./test/statistics.helpers";

/** On the Cards page, opens this Card's preview from its row and presses Delete there. */
function deleteFromPreview(id: string) {
  const remove = screen.getByRole("button", { name: `Delete ${id}` });
  // The row button is the row's other button, beside Delete.
  const others = within(remove.closest("li")!)
    .getAllByRole("button")
    .filter((button) => button !== remove);
  expect(others).toHaveLength(1);
  fireEvent.click(others[0]);
  const preview = within(screen.getByRole("dialog", { name: "Card preview" }));
  fireEvent.click(preview.getByRole("button", { name: "Delete" }));
}

it.each([
  { from: "its row, after asking", remove: deleteFromRow },
  { from: "its preview", remove: deleteFromPreview },
])("deletes one Card from $from, and it stays gone after a reload", async ({ remove }) => {
  const { unmount } = render(<App />);
  upload(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
  await expectListed(qa("ml.trees.leaf-mean", 1));

  remove("ml.trees.leaf-mean");

  await expectNotListed(qa("ml.trees.leaf-mean", 1));
  expect((await screen.findByRole("status")).textContent).toBe("Card deleted.");
  unmount();
  render(<App />);
  await expectListed(qa("ml.trees.depth", 1));
  expect(screen.queryByText(/ml\.trees\.leaf-mean/)).toBeNull();
});

it("Card deleted. goes away when the Learner leaves the Cards page", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));
  openCards();
  deleteFromRow("a");
  await screen.findByText("Card deleted.");

  goHome();
  openCards();

  expect(screen.queryByText("Card deleted.")).toBeNull();
});

describe("Delete all Cards", () => {
  it("asks before deleting all Cards, saying how many and that it cannot be undone", async () => {
    const danger = alertIcon("danger");
    render(<App />);
    await uploaded(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
    openCards();
    expect(deleteAllButton().querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

    const modal = openDeleteAll();

    expect(screen.getByRole("dialog", { name: "Delete all Cards?" })).toBeTruthy();
    expect(modal.getByText("This cannot be undone.")).toBeTruthy();
    expect(
      modal.getByText("All 2 Cards will be permanently removed from this browser."),
    ).toBeTruthy();
    expect(modal.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(modal.getByRole("button", { name: "Delete all Cards" })).toBeTruthy();
    expect(modal.getByRole("button", { name: "Close" })).toBeTruthy();
    const icons = [...screen.getByRole("dialog").querySelectorAll("svg")].map(
      (icon) => icon.outerHTML,
    );
    expect(icons).toContain(danger);
  });

  it("says 1 Card in the singular", async () => {
    render(<App />);
    await uploaded(qa("ml.trees.leaf-mean", 1));

    const modal = openDeleteAll();

    expect(modal.getByText("1 Card will be permanently removed from this browser.")).toBeTruthy();
  });

  it.each<[string, () => void]>([
    [
      "Cancel",
      () =>
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })),
    ],
    [
      "Close",
      () =>
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" })),
    ],
    ["Escape", () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })],
    // The backdrop is the dialog's parent; it has no role to query by.
    [
      "a mouse-down on the backdrop",
      () => fireEvent.mouseDown(screen.getByRole("dialog").parentElement!),
    ],
  ])("%s closes the modal and keeps the Cards, also after a reload", async (_, dismiss) => {
    const { unmount } = render(<App />);
    await uploaded(qa("ml.trees.leaf-mean", 1));
    openDeleteAll();

    dismiss();

    await expectNoDialog();
    await expectListed(qa("ml.trees.leaf-mean", 1));
    unmount();
    render(<App />);
    await expectListed(qa("ml.trees.leaf-mean", 1));
  });

  it("deletes all Cards from the modal, and they stay gone after a reload", async () => {
    const { unmount } = render(<App />);
    await uploaded(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
    expect(screen.queryByRole("heading", { name: "No Cards yet" })).toBeNull();

    fireEvent.click(openDeleteAll().getByRole("button", { name: "Delete all Cards" }));

    await expectNoDialog();
    await expectNotListed(qa("ml.trees.leaf-mean", 1));
    await expectNotListed(qa("ml.trees.depth", 1));
    expect(screen.getByRole("heading", { level: 3, name: "No Cards yet" })).toBeTruthy();
    goHome();
    expect(home().getByRole("heading", { level: 3, name: "No Cards yet" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Start a Session" })).toBeNull();
    unmount();
    render(<App />);
    // An empty list proves nothing before the reload finishes; "1 added" shows storage was empty.
    upload(qa("ml.trees.leaf-mean", 1));
    await screen.findByText(/1 added, 0 updated, 0 unchanged/);
    await expectListed(qa("ml.trees.leaf-mean", 1));
    expect(screen.queryByText(/ml\.trees\.depth/)).toBeNull();
  });

  it("closes the modal before deleting, so a failure shows in the page's error and the Cards stay", async () => {
    render(<App />);
    await uploaded(qa("ml.trees.leaf-mean", 1));
    const modal = openDeleteAll();
    blockStorage();

    fireEvent.click(modal.getByRole("button", { name: "Delete all Cards" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
    expect(screen.queryByRole("dialog")).toBeNull();
    await expectListed(qa("ml.trees.leaf-mean", 1));
  });

  it("with no Cards, the Cards page shows the empty state and disables Delete all Cards", async () => {
    render(<App />);
    openCards();
    expect(home().getByRole("heading", { level: 3, name: "No Cards yet" })).toBeTruthy();
    expect(deleteAllButton().disabled).toBe(true);

    goHome();
    await uploaded(qa("ml.trees.leaf-mean", 1));
    openCards();
    expect(screen.queryByRole("heading", { name: "No Cards yet" })).toBeNull();
    expect(deleteAllButton().disabled).toBe(false);

    fireEvent.click(openDeleteAll().getByRole("button", { name: "Delete all Cards" }));

    await waitFor(() => expect(deleteAllButton().disabled).toBe(true));
  });
});

it("keeps the report of the last upload after deleting a Card", async () => {
  render(<App />);
  upload(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
  await expectListed(qa("ml.trees.leaf-mean", 1));

  deleteFromRow("ml.trees.leaf-mean");

  await expectNotListed(qa("ml.trees.leaf-mean", 1));
  expect(screen.getByText(/2 added, 0 updated, 0 unchanged/)).toBeTruthy();
  expect((await screen.findByRole("status")).textContent).toBe("Card deleted.");
});

it("shows only an error, no Card deleted., and keeps the Card when deleting fails", async () => {
  render(<App />);
  upload(qa("ml.trees.leaf-mean", 1));
  await expectListed(qa("ml.trees.leaf-mean", 1));
  blockStorage();

  deleteFromRow("ml.trees.leaf-mean");

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  await expectListed(qa("ml.trees.leaf-mean", 1));
  expect(screen.queryByText("Card deleted.")).toBeNull();
});
