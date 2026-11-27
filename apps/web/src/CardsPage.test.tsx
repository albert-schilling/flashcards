import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
import {
  confirmDelete,
  deleteAllButton,
  deleteButton,
  listedIds,
  openPreview,
  renderCardsPage,
  rows,
  shownTexts,
  typeNames,
} from "./test/cards.page.helpers";

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
  "a $type row shows the type name, the question or name, the ID and the tags, and Delete shows no word",
  ({ card, title }) => {
    renderCardsPage([card]);

    expect(shownTexts(rows()[0])).toEqual([
      typeNames[card.type].en,
      title,
      "a",
      "Machine Learning",
      "Decision Tree",
    ]);
  },
);

it("a row shows every domain tag, then every topic tag, even a tag in both", () => {
  renderCardsPage([
    tagged(qa("a", 1), ["Statistics", "Machine Learning"], ["Regression", "Statistics"]),
  ]);

  expect(shownTexts(rows()[0])).toEqual([
    "Question & answer",
    "What is a?",
    "a",
    "Statistics",
    "Machine Learning",
    "Regression",
    "Statistics",
  ]);
});

it("shows one row per Card", () => {
  renderCardsPage([qa("a", 1), formula("b", 1), cloze("c", 1)]);

  expect(rows().map((row) => shownTexts(row)[2])).toEqual(["a", "b", "c"]);
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
  const deleteQ = screen.getByRole("button", { name: "q löschen" });
  expect(deleteQ.textContent).toBe("");
  expect(deleteQ.getAttribute("title")).toBe("q löschen");
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

  expect(shownTexts(rows()[0])[1]).toBe(title);
});

it("a cloze row blanks every gap", () => {
  renderCardsPage([cloze("a", 1, "{{A}} tree splits on {{features}}.")]);

  expect(shownTexts(rows()[0])[1]).toBe("____ tree splits on ____.");
});

it("a row's Delete asks first in a modal naming the Card, and deletes nothing yet", () => {
  const { onDelete, onDeleteAll } = renderCardsPage([qa("a", 1), qa("b", 1)]);

  fireEvent.click(deleteButton("b"));

  const modal = within(screen.getByRole("dialog", { name: "Delete this Card?" }));
  expect(modal.getByText("This cannot be undone.")).toBeTruthy();
  expect(modal.getByText("The Card b will be permanently removed from this browser.")).toBeTruthy();
  expect(onDelete).not.toHaveBeenCalled();
  expect(onDeleteAll).not.toHaveBeenCalled();
});

it("Cancel closes the Delete modal and keeps the Card", () => {
  const { onDelete } = renderCardsPage([qa("a", 1)]);
  fireEvent.click(deleteButton("a"));

  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Delete this Card?" })).getByRole("button", {
      name: "Cancel",
    }),
  );

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onDelete).not.toHaveBeenCalled();
  expect(listedIds()).toEqual(["a"]);
});

it("Delete in the modal closes it, deletes that Card and shows Card deleted.", async () => {
  const { onDelete, onDeleteAll } = renderCardsPage([qa("a", 1), qa("b", 1)]);

  confirmDelete("b");

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledWith("b");
  expect(onDeleteAll).not.toHaveBeenCalled();
  expect((await screen.findByRole("status")).textContent).toBe("Card deleted.");
});

it("Delete in the preview deletes at once, closes the preview and shows Card deleted.", async () => {
  const { onDelete } = renderCardsPage([qa("a", 1), qa("b", 1)]);

  fireEvent.click(openPreview("b").getByRole("button", { name: "Delete" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledWith("b");
  expect((await screen.findByRole("status")).textContent).toBe("Card deleted.");
});

it("Card deleted. stays after a second delete, and Dismiss removes it", async () => {
  renderCardsPage([qa("a", 1), qa("b", 1)]);
  confirmDelete("a");
  const notice = await screen.findByRole("status");

  confirmDelete("b");
  // Let the page handle the second onDelete's result before looking.
  await act(async () => {});
  expect(screen.getAllByRole("status")).toEqual([notice]);
  fireEvent.click(within(notice).getByRole("button", { name: "Dismiss" }));

  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText("Card deleted.")).toBeNull();
});

it.each<[string, (id: string) => void]>([
  ["its row", confirmDelete],
  ["its preview", (id) => fireEvent.click(openPreview(id).getByRole("button", { name: "Delete" }))],
])(
  "a failed delete from %s closes the modal first and shows no Card deleted.",
  async (_, remove) => {
    const { onDelete } = renderCardsPage([qa("a", 1)], "en", false);

    remove("a");
    // Let the page handle onDelete's result before looking.
    await act(async () => {});

    expect(onDelete).toHaveBeenCalledWith("a");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Card deleted.")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  },
);

it("a failed delete after a deleted Card removes Card deleted., so only the error shows", async () => {
  const { onDelete } = renderCardsPage([qa("a", 1), qa("b", 1)]);
  onDelete.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  confirmDelete("a");
  await screen.findByRole("status");

  confirmDelete("b");
  // Let the page handle the second onDelete's result before looking.
  await act(async () => {});

  expect(onDelete).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Card deleted.")).toBeNull();
});

it("in German, the Delete modal asks Diese Karte löschen?, and the notice reads Karte gelöscht.", async () => {
  renderCardsPage([qa("q", 1)], "de");

  fireEvent.click(screen.getByRole("button", { name: "q löschen" }));
  const modal = within(screen.getByRole("dialog", { name: "Diese Karte löschen?" }));
  expect(modal.getByText("Das kann nicht rückgängig gemacht werden.")).toBeTruthy();
  expect(modal.getByText("Die Karte q wird endgültig aus diesem Browser entfernt.")).toBeTruthy();
  fireEvent.click(modal.getByRole("button", { name: "Löschen" }));

  const notice = await screen.findByRole("status");
  expect(notice.textContent).toBe("Karte gelöscht.");
  expect(within(notice).getByRole("button", { name: "Ausblenden" })).toBeTruthy();
});

describe("Delete all Cards", () => {
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
});
