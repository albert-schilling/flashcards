import type { Card } from "@flashcards/cards";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "./App";

function qa(id: string, version: number, answer = "An answer."): Card {
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

function upload(...cards: Card[]) {
  const file = new File([JSON.stringify({ cards })], "deck.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Upload Deck"), { target: { files: [file] } });
}

async function expectListed(card: Card) {
  const item = (await screen.findByText(new RegExp(card.id.replaceAll(".", "\\.")))).closest("li");
  expect(item?.textContent).toContain(card.type);
  expect(item?.textContent).toContain(String(card.version));
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
