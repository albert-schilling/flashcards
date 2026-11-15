import type { TCard, TCardQA } from "@flashcards/cards";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "./App";

function qa(id: string, version: number, answer = "An answer."): TCardQA {
  return {
    id,
    version,
    tags: { domain: ["Machine Learning"], topic: ["Decision Tree"] },
    sourceIds: [],
    lesson: "lesson-04",
    type: "qa",
    en: { question: `What is ${id}?`, answer },
  };
}

function upload(...cards: TCard[]) {
  pick(new File([JSON.stringify({ cards })], "deck.json", { type: "application/json" }));
}

function pick(file: File) {
  const input = screen.getByLabelText<HTMLInputElement>("Upload Deck");
  // jsdom can't pick a file, so act like a browser: the value names the file until set to "".
  let files = [file];
  Object.defineProperty(input, "files", { configurable: true, get: () => files });
  Object.defineProperty(input, "value", {
    configurable: true,
    get: () => (files.length ? `C:\\fakepath\\${files[0].name}` : ""),
    set: (value: string) => {
      if (value === "") files = [];
    },
  });
  fireEvent.change(input);
}

async function expectListed(card: TCard) {
  await screen.findByText(`${card.id} (${card.type}, version ${card.version})`);
}

it("renders the start page with the app name", () => {
  render(<App />);

  const heading = screen.getByRole("heading", { name: "Flashcards" });

  expect(heading.textContent).toBe("Flashcards");
});

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
  globalThis.indexedDB = {
    open() {
      throw new DOMException("Storage is blocked.", "SecurityError");
    },
  } as unknown as IDBFactory;

  render(<App />);

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
});

it("shows an error when the file can't be read", async () => {
  const file = new File([], "deck.json");
  file.text = () => Promise.reject(new DOMException("The file is gone.", "NotReadableError"));
  render(<App />);

  pick(file);

  expect((await screen.findByRole("alert")).textContent).toContain("The file is gone.");
});

it("hides the report of the last upload when the next one fails", async () => {
  render(<App />);
  upload(qa("ml.trees.leaf-mean", 1));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);

  const file = new File([], "deck.json");
  file.text = () => Promise.reject(new DOMException("The file is gone.", "NotReadableError"));
  pick(file);

  await screen.findByRole("alert");
  expect(screen.queryByText(/1 added, 0 updated, 0 unchanged/)).toBeNull();
});

async function expectNotListed(card: TCard) {
  await waitFor(() =>
    expect(screen.queryByText(`${card.id} (${card.type}, version ${card.version})`)).toBeNull(),
  );
}

it("deletes one Card, and it stays gone after a reload", async () => {
  const { unmount } = render(<App />);
  upload(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
  await expectListed(qa("ml.trees.leaf-mean", 1));

  fireEvent.click(screen.getByRole("button", { name: "Delete ml.trees.leaf-mean" }));

  await expectNotListed(qa("ml.trees.leaf-mean", 1));
  unmount();
  render(<App />);
  await expectListed(qa("ml.trees.depth", 1));
  expect(screen.queryByText(/ml\.trees\.leaf-mean/)).toBeNull();
});

it("keeps the Cards when clearing all is cancelled", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  try {
    const { unmount } = render(<App />);
    upload(qa("ml.trees.leaf-mean", 1));
    await expectListed(qa("ml.trees.leaf-mean", 1));

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(confirm).toHaveBeenCalledWith("Delete all Cards?");
    unmount();
    render(<App />);
    await expectListed(qa("ml.trees.leaf-mean", 1));
  } finally {
    confirm.mockRestore();
  }
});

it("clears all Cards after confirming, and they stay gone after a reload", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  try {
    const { unmount } = render(<App />);
    upload(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
    await expectListed(qa("ml.trees.depth", 1));

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(confirm).toHaveBeenCalledWith("Delete all Cards?");
    await expectNotListed(qa("ml.trees.leaf-mean", 1));
    await expectNotListed(qa("ml.trees.depth", 1));
    unmount();
    render(<App />);
    // Uploading a cleared Card again adds it, and the other one stays gone.
    upload(qa("ml.trees.leaf-mean", 1));
    await screen.findByText(/1 added, 0 updated, 0 unchanged/);
    await expectListed(qa("ml.trees.leaf-mean", 1));
    expect(screen.queryByText(/ml\.trees\.depth/)).toBeNull();
  } finally {
    confirm.mockRestore();
  }
});

it("shows Clear all only while Cards are stored", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  try {
    render(<App />);
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();

    upload(qa("ml.trees.leaf-mean", 1));
    fireEvent.click(await screen.findByRole("button", { name: "Clear all" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull());
  } finally {
    confirm.mockRestore();
  }
});

it("keeps the report of the last upload after deleting a Card", async () => {
  render(<App />);
  upload(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
  await expectListed(qa("ml.trees.leaf-mean", 1));

  fireEvent.click(screen.getByRole("button", { name: "Delete ml.trees.leaf-mean" }));

  await expectNotListed(qa("ml.trees.leaf-mean", 1));
  expect(screen.getByText(/2 added, 0 updated, 0 unchanged/)).toBeTruthy();
});

it("shows an error and keeps the Card when deleting fails", async () => {
  render(<App />);
  upload(qa("ml.trees.leaf-mean", 1));
  await expectListed(qa("ml.trees.leaf-mean", 1));
  globalThis.indexedDB = {
    open() {
      throw new DOMException("Storage is blocked.", "SecurityError");
    },
  } as unknown as IDBFactory;

  fireEvent.click(screen.getByRole("button", { name: "Delete ml.trees.leaf-mean" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  await expectListed(qa("ml.trees.leaf-mean", 1));
});
