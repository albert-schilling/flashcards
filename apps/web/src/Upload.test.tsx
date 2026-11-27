import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "./App";
import { alertIcon, blockStorage, expectListed, pick, upload } from "./test/app.helpers";
import { qa } from "./test/cards.fixtures";

it("shows the counts and lists the Cards after an upload", async () => {
  render(<App />);

  upload(qa("ml.trees.leaf-mean", 2), qa("ml.trees.depth", 1));

  await screen.findByText(/2 added, 0 updated, 0 unchanged/);
  await expectListed(qa("ml.trees.leaf-mean", 2));
  await expectListed(qa("ml.trees.depth", 1));
});

it("shows the errors of an invalid file", async () => {
  render(<App />);

  upload(qa("ml.trees.leaf-mean", 1, ""));

  await screen.findByText(/File rejected/);
  expect(screen.getByText(/ml\.trees\.leaf-mean: en\.answer: /)).toBeTruthy();
});

it("shows the report of a rejected file without interrupting, so only errors are alerts", async () => {
  render(<App />);

  upload(qa("ml.trees.leaf-mean", 1, ""));

  await screen.findByText(/File rejected/);
  expect(screen.queryByRole("alert")).toBeNull();
});

function shownIcons(): string[] {
  return [...document.querySelectorAll("svg")].map((icon) => icon.outerHTML);
}

it("shows the success icon with an accepted upload and the danger icon with a rejected one", async () => {
  const success = alertIcon("success");
  const danger = alertIcon("danger");
  render(<App />);

  upload(qa("ml.trees.leaf-mean", 1));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);
  expect(shownIcons()).toContain(success);
  expect(shownIcons()).not.toContain(danger);

  upload(qa("ml.trees.depth", 1, ""));
  await screen.findByText(/File rejected/);
  expect(shownIcons()).toContain(danger);
  expect(shownIcons()).not.toContain(success);
});

it("lists the stored Cards after a reload", async () => {
  const { unmount } = render(<App />);
  upload(qa("ml.trees.leaf-mean", 3));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);
  unmount();

  render(<App />);

  await expectListed(qa("ml.trees.leaf-mean", 3));
});

it("asks the browser to keep its storage", async () => {
  const persist = vi.fn(() => Promise.resolve(true));
  Object.defineProperty(navigator, "storage", { value: { persist }, configurable: true });
  try {
    render(<App />);

    await waitFor(() => expect(persist).toHaveBeenCalled());
  } finally {
    Reflect.deleteProperty(navigator, "storage");
  }
});

it("clears the file input after an upload, so the same file can be picked again", async () => {
  render(<App />);

  upload(qa("ml.trees.leaf-mean", 1));

  await screen.findByText(/1 added, 0 updated, 0 unchanged/);
  expect(screen.getByLabelText<HTMLInputElement>("Upload Deck").value).toBe("");
});

it("shows an error when the browser storage fails", async () => {
  blockStorage();

  render(<App />);

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
});

it("shows an error when the file can't be read", async () => {
  const file = new File([], "deck.json");
  file.text = () => Promise.reject(new DOMException("The file is gone.", "NotReadableError"));
  render(<App />);

  pick(file, "Upload Deck");

  expect((await screen.findByRole("alert")).textContent).toContain("The file is gone.");
});

it("hides the report of the last upload when the next one fails", async () => {
  render(<App />);
  upload(qa("ml.trees.leaf-mean", 1));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);

  const file = new File([], "deck.json");
  file.text = () => Promise.reject(new DOMException("The file is gone.", "NotReadableError"));
  pick(file, "Upload Deck");

  await screen.findByRole("alert");
  expect(screen.queryByText(/1 added, 0 updated, 0 unchanged/)).toBeNull();
});

it("keeps the error of a failed upload when an earlier upload finishes later", async () => {
  render(<App />);
  const deck = JSON.stringify({ cards: [qa("ml.trees.leaf-mean", 1)] });
  const slow = new File([deck], "deck.json", { type: "application/json" });
  // Hold the first file open, so the second upload fails before the first one finishes.
  let finishReading = () => {};
  slow.text = () =>
    new Promise((resolve) => {
      finishReading = () => resolve(deck);
    });
  pick(slow, "Upload Deck");
  const failing = new File([], "deck.json");
  failing.text = () => Promise.reject(new DOMException("The file is gone.", "NotReadableError"));
  pick(failing, "Upload Deck");
  await screen.findByRole("alert");

  finishReading();

  await expectListed(qa("ml.trees.leaf-mean", 1));
  expect(screen.getByRole("alert").textContent).toContain("The file is gone.");
  expect(screen.queryByText(/1 added, 0 updated, 0 unchanged/)).toBeNull();
});
