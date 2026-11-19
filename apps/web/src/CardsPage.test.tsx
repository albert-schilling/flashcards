import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CardsPage } from "./CardsPage";
import { LanguageContext, type TLanguage } from "./language.context";
import {
  cloze,
  formula,
  german,
  multipleChoice,
  numeric,
  qa,
  tagged,
  trueFalse,
} from "./test/cards.fixtures";

/** Renders the Cards page with these Cards in this language and returns its callback mocks. */
function renderCardsPage(cards: TCard[], language: TLanguage = "en") {
  const onDelete = vi.fn();
  const onDeleteAll = vi.fn();
  render(
    <LanguageContext.Provider value={language}>
      <CardsPage cards={cards} onDelete={onDelete} onDeleteAll={onDeleteAll} />
    </LanguageContext.Provider>,
  );
  return { onDelete, onDeleteAll };
}

function rows() {
  return screen.getAllByRole("listitem");
}

/** The texts a reader sees in this element, in order, one entry per text node. */
function shownTexts(element: HTMLElement): string[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const texts: string[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent!.trim();
    if (text) texts.push(text);
  }
  return texts;
}

function deleteAllButton() {
  return screen.getByRole<HTMLButtonElement>("button", { name: "Delete all Cards" });
}

it("shows the Library heading, with Cards as its only level-1 heading", () => {
  renderCardsPage([qa("a", 1)]);

  expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Cards"]);
  expect(screen.getByText("Library")).toBeTruthy();
  expect(
    screen.getByText("Search, organize, preview, and back up every Card in one place."),
  ).toBeTruthy();
});

it("shows the Library heading in German", () => {
  renderCardsPage([qa("a", 1)], "de");

  expect(screen.getByRole("heading", { level: 1, name: "Karten" })).toBeTruthy();
  expect(screen.getByText("Bibliothek")).toBeTruthy();
  expect(
    screen.getByText("Karten suchen, ordnen, ansehen und sichern, alles an einem Ort."),
  ).toBeTruthy();
});

it.each([
  { cards: [qa("a", 1), qa("b", 1)], count: "2 Cards" },
  { cards: [qa("a", 1)], count: "1 Card" },
])("counts the Cards: $count", ({ cards, count }) => {
  renderCardsPage(cards);

  expect(screen.getByText(count)).toBeTruthy();
});

it.each([
  { type: "qa", card: qa("a", 1), title: "What is a?" },
  { type: "multiple_choice", card: multipleChoice("a", 1), title: "Which is a?" },
  { type: "numeric", card: numeric("a", 1), title: "How much is a?" },
  { type: "formula", card: formula("a", 1), title: "The a formula" },
  { type: "true_false", card: trueFalse("a", 1), title: "a is true." },
  { type: "cloze", card: cloze("a", 1), title: "a has a ____." },
])(
  "a $type row shows the question or name, the ID, the type, the tags and Delete",
  ({ type, card, title }) => {
    renderCardsPage([card]);

    expect(shownTexts(rows()[0])).toEqual([
      title,
      "a",
      type,
      "Machine Learning",
      "Decision Tree",
      "Delete",
    ]);
  },
);

it("a row shows every domain tag, then every topic tag, even a tag in both", () => {
  renderCardsPage([
    tagged(qa("a", 1), ["Statistics", "Machine Learning"], ["Regression", "Statistics"]),
  ]);

  expect(shownTexts(rows()[0])).toEqual([
    "What is a?",
    "a",
    "qa",
    "Statistics",
    "Machine Learning",
    "Regression",
    "Statistics",
    "Delete",
  ]);
});

it("shows one row per Card", () => {
  renderCardsPage([qa("a", 1), formula("b", 1), cloze("c", 1)]);

  expect(rows().map((row) => shownTexts(row)[1])).toEqual(["a", "b", "c"]);
});

it("in German, a row shows the German question, and English where there is no German", () => {
  renderCardsPage(
    [german(qa("q", 1), { question: "Was ist q?" }), qa("e", 1), cloze("c", 1)],
    "de",
  );

  expect(within(rows()[0]).getByText("Was ist q?")).toBeTruthy();
  expect(within(rows()[0]).queryByText("What is q?")).toBeNull();
  expect(within(rows()[1]).getByText("What is e?")).toBeTruthy();
  expect(within(rows()[2]).getByText("c has a ____.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "q löschen" }).textContent).toBe("Löschen");
});

it("Delete on a row deletes that Card", () => {
  const { onDelete, onDeleteAll } = renderCardsPage([qa("a", 1), qa("b", 1)]);

  fireEvent.click(screen.getByRole("button", { name: "Delete b" }));

  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledWith("b");
  expect(onDeleteAll).not.toHaveBeenCalled();
});

it("Delete all Cards asks in a modal first, and its Delete all Cards closes the modal and deletes", () => {
  const { onDelete, onDeleteAll } = renderCardsPage([qa("a", 1), qa("b", 1)]);

  fireEvent.click(deleteAllButton());

  expect(onDeleteAll).not.toHaveBeenCalled();
  const modal = within(screen.getByRole("dialog", { name: "Delete all Cards?" }));
  expect(
    modal.getByText("All 2 Cards will be permanently removed from this browser."),
  ).toBeTruthy();
  fireEvent.click(modal.getByRole("button", { name: "Delete all Cards" }));
  expect(onDeleteAll).toHaveBeenCalledTimes(1);
  expect(onDelete).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("Cancel closes the modal and deletes nothing", () => {
  const { onDeleteAll } = renderCardsPage([qa("a", 1)]);
  fireEvent.click(deleteAllButton());

  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onDeleteAll).not.toHaveBeenCalled();
});

it("with no Cards, shows the empty state and no rows, and disables Delete all Cards", () => {
  renderCardsPage([]);

  expect(screen.getByRole("heading", { level: 3, name: "No Cards yet" })).toBeTruthy();
  expect(screen.queryAllByRole("listitem")).toEqual([]);
  expect(deleteAllButton().disabled).toBe(true);
});
