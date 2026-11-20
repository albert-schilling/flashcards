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

/** Renders the Cards page with these Cards in this language and returns its callback mocks, and `rerender` to show other Cards on the same page. */
function renderCardsPage(cards: TCard[], language: TLanguage = "en") {
  const onDelete = vi.fn();
  const onDeleteAll = vi.fn();
  const page = (cards: TCard[]) => (
    <LanguageContext.Provider value={language}>
      <CardsPage cards={cards} onDelete={onDelete} onDeleteAll={onDeleteAll} />
    </LanguageContext.Provider>
  );
  const { rerender } = render(page(cards));
  return { onDelete, onDeleteAll, rerender: (cards: TCard[]) => rerender(page(cards)) };
}

function rows() {
  return screen.getAllByRole("listitem");
}

/** The IDs of the listed Cards, in order; none when no list shows. */
function listedIds(): string[] {
  return screen.queryAllByRole("listitem").map((row) => shownTexts(row)[1]);
}

function search(query: string, label = "Search Cards") {
  fireEvent.change(screen.getByRole("searchbox", { name: label }), { target: { value: query } });
}

function typeSelect(label = "Type") {
  return screen.getByLabelText<HTMLSelectElement>(label);
}

function tagSelect() {
  return screen.getByLabelText<HTMLSelectElement>("Tag");
}

function pickType(type: string) {
  fireEvent.change(typeSelect(), { target: { value: type } });
}

function pickTag(tag: string) {
  fireEvent.change(tagSelect(), { target: { value: tag } });
}

/** The option texts of this select, in order. */
function optionTexts(select: HTMLSelectElement): string[] {
  return [...select.options].map((option) => option.textContent!);
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
  { cards: [qa("a", 1), qa("b", 1)], count: "2 of 2 Cards" },
  { cards: [qa("a", 1)], count: "1 of 1 Card" },
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

it.each([
  {
    type: "multiple_choice",
    card: german(multipleChoice("a", 1), { question: "Welches ist a?" }),
    title: "Welches ist a?",
  },
  {
    type: "numeric",
    card: german(numeric("a", 1), { question: "Wie viel ist a?" }),
    title: "Wie viel ist a?",
  },
  {
    type: "formula",
    card: german(formula("a", 1), { name: "Die a-Formel" }),
    title: "Die a-Formel",
  },
  {
    type: "true_false",
    card: german(trueFalse("a", 1), { statement: "a ist wahr." }),
    title: "a ist wahr.",
  },
  {
    type: "cloze",
    card: german(cloze("a", 1), { text: "a hat eine {{Lücke}}." }),
    title: "a hat eine ____.",
  },
])("in German, a translated $type row shows its German text", ({ card, title }) => {
  renderCardsPage([card], "de");

  expect(shownTexts(rows()[0])[0]).toBe(title);
});

it("a cloze row blanks every gap", () => {
  renderCardsPage([cloze("a", 1, "{{A}} tree splits on {{features}}.")]);

  expect(shownTexts(rows()[0])[0]).toBe("____ tree splits on ____.");
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

it.each([
  { case: "with Cards", cards: [qa("a", 1)] },
  { case: "with no Cards", cards: [] },
])("$case, shows its children right after the Card list panel", ({ cards }) => {
  render(
    <LanguageContext.Provider value="en">
      <CardsPage cards={cards} onDelete={vi.fn()} onDeleteAll={vi.fn()}>
        <aside>Second column</aside>
      </CardsPage>
    </LanguageContext.Provider>,
  );

  const list = deleteAllButton().closest("section")!;

  expect(list.nextElementSibling).toBe(screen.getByText("Second column"));
});

/** The Card with tags that none of the search tests looks for. */
function plain<T extends TCard>(card: T): T {
  return tagged(card, ["Statistics"], ["Regression"]);
}

/** One Card per search: no query below matches two of them. */
const library = [
  plain(qa("a", 1)),
  plain(formula("x", 1)),
  plain(trueFalse("y", 1)),
  plain(cloze("b", 1, "Some {{gap}} here.")),
  tagged(multipleChoice("m", 1), ["Machine Learning"], ["Decision Tree"]),
];

it.each([
  { finds: "a qa question", query: "WHAT IS A", ids: ["a"] },
  { finds: "a formula name", query: "The X Formula", ids: ["x"] },
  { finds: "a true_false statement", query: "y IS TRUE", ids: ["y"] },
  { finds: "a cloze text", query: "some", ids: ["b"] },
  { finds: "an ID", query: "B", ids: ["b"] },
  { finds: "a domain tag", query: "machine learning", ids: ["m"] },
  { finds: "a topic tag", query: "decision tree", ids: ["m"] },
  { finds: "a query with spaces around it", query: "  b  ", ids: ["b"] },
])("search finds $finds, ignoring case: $query", ({ query, ids }) => {
  renderCardsPage(library);

  search(query);

  expect(listedIds()).toEqual(ids);
});

it("search looks in a cloze text with its gaps blank, as the row shows it", () => {
  renderCardsPage(library);

  search("gap");

  expect(listedIds()).toEqual([]);
});

it("a search of only spaces lists every Card", () => {
  renderCardsPage(library);

  search("   ");

  expect(listedIds()).toEqual(["a", "x", "y", "b", "m"]);
});

it("in German, search finds a Card by its German question, not its English one", () => {
  renderCardsPage([german(qa("q", 1), { question: "Was ist q?" }), qa("e", 1)], "de");

  search("WAS IST", "Karten suchen");
  expect(listedIds()).toEqual(["q"]);

  search("What is q", "Karten suchen");
  expect(listedIds()).toEqual([]);
});

it("the search field is labelled Search Cards and asks for a question, ID or tag", () => {
  renderCardsPage([qa("a", 1)]);

  const field = screen.getByRole<HTMLInputElement>("searchbox", { name: "Search Cards" });

  expect(field.placeholder).toBe("Question, ID, or Tag");
  expect(field.value).toBe("");
});

it("Type formula lists only the formula Cards", () => {
  renderCardsPage([qa("a", 1), formula("x", 1), cloze("b", 1), formula("z", 1)]);

  pickType("formula");

  expect(listedIds()).toEqual(["x", "z"]);
});

it.each([
  { kind: "domain", tag: "Statistics", ids: ["a", "c"] },
  { kind: "topic", tag: "Decision Tree", ids: ["c", "d"] },
])("a Tag lists only the Cards with it as a $kind tag", ({ tag, ids }) => {
  renderCardsPage([
    tagged(qa("a", 1), ["Statistics"], ["Regression"]),
    tagged(qa("b", 1), ["Machine Learning"], ["Regression"]),
    tagged(formula("c", 1), ["Statistics"], ["Decision Tree"]),
    tagged(cloze("d", 1), ["Machine Learning"], ["Decision Tree"]),
  ]);

  pickTag(tag);

  expect(listedIds()).toEqual(ids);
});

/** Each filter alone lets more than f1 through. */
const mixed = [
  tagged(formula("f1", 1), ["Statistics"], ["Regression"]),
  tagged(formula("f2", 1), ["Statistics"], ["Regression"]),
  tagged(qa("q1", 1), ["Statistics"], ["Regression"]),
  tagged(formula("g1", 1), ["Statistics"], ["Decision Tree"]),
];

it("search, Type and Tag together list only the Cards that match all three", () => {
  renderCardsPage(mixed);

  search("1");
  pickType("formula");
  pickTag("Regression");

  expect(listedIds()).toEqual(["f1"]);
  expect(screen.getByText("1 of 4 Cards")).toBeTruthy();
});

it("clearing the search, Type and Tag lists every Card again", () => {
  renderCardsPage(mixed);
  search("1");
  pickType("formula");
  pickTag("Regression");

  search("");
  pickType("");
  pickTag("");

  expect(listedIds()).toEqual(["f1", "f2", "q1", "g1"]);
  expect(screen.getByText("4 of 4 Cards")).toBeTruthy();
});

it("the Type select offers All types, then the six Card types, whatever types the Cards have", () => {
  renderCardsPage([qa("a", 1)]);

  const types = ["qa", "multiple_choice", "formula", "numeric", "cloze", "true_false"];
  expect(typeSelect().value).toBe("");
  expect(optionTexts(typeSelect())).toEqual(["All types", ...types]);
  expect([...typeSelect().options].map((option) => option.value)).toEqual(["", ...types]);
});

it("the Tag select offers Any tag, then every tag of the Cards once, sorted", () => {
  renderCardsPage([
    tagged(qa("a", 1), ["Statistics", "Machine Learning"], ["Regression", "Statistics"]),
    tagged(qa("b", 1), ["Machine Learning"], ["Decision Tree"]),
  ]);

  expect(tagSelect().value).toBe("");
  expect(optionTexts(tagSelect())).toEqual([
    "Any tag",
    "Decision Tree",
    "Machine Learning",
    "Regression",
    "Statistics",
  ]);
});

it("when the last Card with the picked tag goes, the Tag goes back to Any tag and every Card shows", () => {
  const { rerender } = renderCardsPage([
    plain(qa("a", 1)),
    tagged(qa("b", 1), ["Machine Learning"], ["Decision Tree"]),
    plain(qa("c", 1)),
  ]);
  pickTag("Decision Tree");
  expect(listedIds()).toEqual(["b"]);

  rerender([plain(qa("a", 1)), plain(qa("c", 1))]);

  expect(tagSelect().value).toBe("");
  expect(listedIds()).toEqual(["a", "c"]);
  expect(screen.getByText("2 of 2 Cards")).toBeTruthy();
});

it("the search stays when the Cards change, so deleting the only match shows the no-match state", () => {
  const { rerender } = renderCardsPage([qa("a", 1), qa("b", 1)]);
  search("b");
  expect(listedIds()).toEqual(["b"]);

  rerender([qa("a", 1)]);

  expect(screen.getByRole<HTMLInputElement>("searchbox", { name: "Search Cards" }).value).toBe("b");
  expect(screen.getByText("0 of 1 Card")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 3, name: "No matching Cards" })).toBeTruthy();
});

it.each([
  { count: "1 of 3 Cards", cards: [qa("a", 1), qa("b", 1), qa("c", 1)], query: "b" },
  { count: "1 of 2 Cards", cards: [qa("a", 1), qa("b", 1)], query: "b" },
  { count: "0 of 1 Card", cards: [qa("a", 1)], query: "zzz" },
])("the count shows the listed and all Cards, the plural following all: $count", (row) => {
  renderCardsPage(row.cards);

  search(row.query);

  expect(screen.getByText(row.count)).toBeTruthy();
});

it.each([
  { by: "a search", filter: () => search("zzz") },
  { by: "a Type", filter: () => pickType("numeric") },
])("when $by matches no Card, shows 0 of 2 Cards, no list and the no-match state", ({ filter }) => {
  renderCardsPage([qa("a", 1), formula("b", 1)]);

  filter();

  expect(screen.getByText("0 of 2 Cards")).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
  expect(screen.getByRole("heading", { level: 3, name: "No matching Cards" })).toBeTruthy();
  expect(screen.getByText("Try another search, type or tag.")).toBeTruthy();
  expect(screen.queryByText("No Cards yet")).toBeNull();
});

it("with no Cards, shows the toolbar, 0 of 0 Cards and No Cards yet, not the no-match state", () => {
  renderCardsPage([]);

  expect(screen.getByRole("searchbox", { name: "Search Cards" })).toBeTruthy();
  expect(typeSelect()).toBeTruthy();
  expect(tagSelect()).toBeTruthy();
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 3, name: "No Cards yet" })).toBeTruthy();
  expect(screen.queryByText("No matching Cards")).toBeNull();
});

it("Delete all Cards still counts and deletes every Card while a search hides them", () => {
  const { onDeleteAll } = renderCardsPage([qa("a", 1), qa("b", 1), qa("c", 1)]);
  search("zzz");

  expect(deleteAllButton().disabled).toBe(false);
  fireEvent.click(deleteAllButton());

  const modal = within(screen.getByRole("dialog", { name: "Delete all Cards?" }));
  expect(
    modal.getByText("All 3 Cards will be permanently removed from this browser."),
  ).toBeTruthy();
  fireEvent.click(modal.getByRole("button", { name: "Delete all Cards" }));
  expect(onDeleteAll).toHaveBeenCalledTimes(1);
});

it("in German, shows the toolbar labels and the count", () => {
  renderCardsPage([qa("a", 1), qa("b", 1)], "de");

  const field = screen.getByRole<HTMLInputElement>("searchbox", { name: "Karten suchen" });
  expect(field.placeholder).toBe("Frage, ID oder Tag");
  expect(optionTexts(typeSelect("Typ"))[0]).toBe("Alle Typen");
  expect(optionTexts(tagSelect())[0]).toBe("Alle Tags");
  expect(screen.getByText("2 von 2 Karten")).toBeTruthy();

  search("b", "Karten suchen");

  expect(screen.getByText("1 von 2 Karten")).toBeTruthy();
});

it("in German, a search that matches nothing shows the German no-match state", () => {
  renderCardsPage([qa("a", 1)], "de");

  search("zzz", "Karten suchen");

  expect(screen.getByText("0 von 1 Karte")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 3, name: "Keine passenden Karten" })).toBeTruthy();
  expect(
    screen.getByText("Versuch es mit einer anderen Suche, einem anderen Typ oder Tag."),
  ).toBeTruthy();
  expect(screen.queryByText("Noch keine Karten")).toBeNull();
});
