import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardsPage } from "./CardsPage";
import { LanguageContext } from "./language.context";
import {
  cloze,
  formula,
  german,
  multipleChoice,
  qa,
  tagged,
  trueFalse,
} from "./test/cards.fixtures";
import {
  deleteAllButton,
  listedIds,
  pickTag,
  pickType,
  renderCardsPage,
  search,
  shownTexts,
  tagSelect,
  typeNames,
  typeSelect,
} from "./test/cards.page.helpers";

const cardTypes = Object.keys(typeNames) as TCard["type"][];

/** The option texts of this select, in order. */
function optionTexts(select: HTMLSelectElement): string[] {
  return [...select.options].map((option) => option.textContent!);
}

it.each([
  { case: "with Cards", cards: [qa("a", 1)] },
  { case: "with no Cards", cards: [] },
])("$case, shows its children right after the Card list panel", ({ cards }) => {
  render(
    <LanguageContext.Provider value="en">
      <CardsPage
        cards={cards}
        onDelete={vi.fn()}
        onDeleteAll={vi.fn()}
        onSave={vi.fn()}
        onNewSession={vi.fn()}
      >
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

describe("search", () => {
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
});

describe("Type and Tag", () => {
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

  it("the Type select offers All types, then the six Card type names, whatever types the Cards have", () => {
    renderCardsPage([qa("a", 1)]);

    expect(typeSelect().value).toBe("");
    expect(optionTexts(typeSelect())).toEqual([
      "All types",
      ...cardTypes.map((type) => typeNames[type].en),
    ]);
    expect([...typeSelect().options].map((option) => option.value)).toEqual(["", ...cardTypes]);
  });

  it("in German, the Type select offers the German type names, and Formel lists only the formula Cards", () => {
    renderCardsPage([qa("a", 1), formula("x", 1), cloze("b", 1), formula("z", 1)], "de");
    const select = typeSelect("Typ");

    expect([...select.options].map((option) => [option.value, option.textContent])).toEqual([
      ["", "Alle Typen"],
      ...cardTypes.map((type) => [type, typeNames[type].de]),
    ]);
    // Picks the option a reader sees as Formel.
    const formel = [...select.options].find((option) => option.textContent === "Formel")!;
    fireEvent.change(select, { target: { value: formel.value } });
    expect(listedIds()).toEqual(["x", "z"]);
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

it.each([
  { language: "en" as const, count: "1 of 1 Card", label: "Windowed list" },
  { language: "de" as const, count: "1 von 1 Karte", label: "Fensterliste" },
])("the summary shows only the count, no $label", ({ language, count, label }) => {
  renderCardsPage([qa("a", 1)], language);

  const summary = screen.getByText(count).parentElement!;

  expect(screen.queryByText(label)).toBeNull();
  expect(shownTexts(summary)).toEqual([count]);
  expect(summary.querySelector("svg")).toBeNull();
});
