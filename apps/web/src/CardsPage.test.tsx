import type { TCard } from "@flashcards/cards";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Trash2 } from "lucide-react";
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

/** Renders the Cards page with these Cards in this language and returns its callback mocks, and `rerender` to show other Cards on the same page. `deletes` and `saves` are what onDelete and onSave resolve to: whether App deleted or saved the Card. */
function renderCardsPage(cards: TCard[], language: TLanguage = "en", deletes = true, saves = true) {
  const onDelete = vi.fn().mockResolvedValue(deletes);
  const onDeleteAll = vi.fn();
  const onSave = vi.fn().mockResolvedValue(saves);
  const page = (cards: TCard[]) => (
    <LanguageContext.Provider value={language}>
      <CardsPage cards={cards} onDelete={onDelete} onDeleteAll={onDeleteAll} onSave={onSave} />
    </LanguageContext.Provider>
  );
  const { rerender } = render(page(cards));
  return { onDelete, onDeleteAll, onSave, rerender: (cards: TCard[]) => rerender(page(cards)) };
}

function rows() {
  return screen.getAllByRole("listitem");
}

/** The IDs of the listed Cards, in order; none when no list shows. A row shows its type name, title, then ID. */
function listedIds(): string[] {
  return screen.queryAllByRole("listitem").map((row) => shownTexts(row)[2]);
}

/** Each Card type's name in English and German, in the Type select's order. */
const typeNames: Record<TCard["type"], { en: string; de: string }> = {
  qa: { en: "Question & answer", de: "Frage & Antwort" },
  multiple_choice: { en: "Multiple choice", de: "Multiple Choice" },
  formula: { en: "Formula", de: "Formel" },
  numeric: { en: "Numeric", de: "Numerisch" },
  cloze: { en: "Fill the gap", de: "Lückentext" },
  true_false: { en: "True or false", de: "Wahr oder falsch" },
};

const cardTypes = Object.keys(typeNames) as TCard["type"][];

/** Card a of each type, in each language, with its type name there. */
const typeCases = [qa, multipleChoice, formula, numeric, cloze, trueFalse].flatMap((make) =>
  (["en", "de"] as const).map((language) => {
    const card: TCard = make("a", 1);
    return { card, language, name: typeNames[card.type][language] };
  }),
);

/** The tags in this element's tags row, in order, each with its style: tag-domain or tag-topic. */
function styledTags(element: HTMLElement): string[][] {
  return Array.from(element.querySelector(".row-tags")!.children, (tag) => [
    tag.textContent!,
    ["tag-domain", "tag-topic"].filter((style) => tag.classList.contains(style)).join(" "),
  ]);
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

/** The button of this Card's row that opens its preview: the row's other button, beside Delete. Fails while the row has no such button. */
function rowButton(id: string): HTMLButtonElement {
  // The row's Delete, named in English or German.
  const remove = screen.getByRole("button", {
    name: (name) => name === `Delete ${id}` || name === `${id} löschen`,
  });
  const others = within(remove.closest("li")!)
    .getAllByRole<HTMLButtonElement>("button")
    .filter((button) => button !== remove);
  expect(others).toHaveLength(1);
  return others[0];
}

function previewDialog() {
  return screen.getByRole("dialog", { name: "Card preview" });
}

/** Opens this Card's preview from its row and returns queries inside it. */
function openPreview(id: string) {
  fireEvent.click(rowButton(id));
  return within(previewDialog());
}

/** Presses this Card's row Delete, then Delete in the modal that asks first. */
function confirmDelete(id: string) {
  fireEvent.click(deleteButton(id));
  const modal = within(screen.getByRole("dialog", { name: "Delete this Card?" }));
  fireEvent.click(modal.getByRole("button", { name: "Delete" }));
}

it("a row holds two buttons side by side: the row button with the Card's copy, then Delete", () => {
  renderCardsPage([qa("a", 1)]);

  const buttons = within(rows()[0]).getAllByRole("button");

  expect(buttons).toHaveLength(2);
  expect(buttons[1]).toBe(deleteButton("a"));
  expect(shownTexts(buttons[0])).toEqual([
    "Question & answer",
    "What is a?",
    "a",
    "Machine Learning",
    "Decision Tree",
  ]);
  expect(buttons[0].querySelector("button")).toBeNull();
});

it("a row's Delete shows only the preview's trash icon, hidden from screen readers, with its name as a tooltip", () => {
  renderCardsPage([qa("a", 1)]);
  const { container, unmount } = render(<Trash2 />);
  const trash = container.querySelector("svg")!.innerHTML;
  unmount();

  const icon = deleteButton("a").querySelector("svg");
  expect(deleteButton("a").textContent).toBe("");
  expect(icon?.innerHTML).toBe(trash);
  expect(icon?.getAttribute("aria-hidden")).toBe("true");
  expect(deleteButton("a").getAttribute("title")).toBe("Delete a");
});

it("a row button opens the Card preview of its Card", () => {
  renderCardsPage([qa("a", 1), qa("b", 1)]);

  const preview = openPreview("b");

  expect(preview.getByRole("heading", { level: 3 }).textContent).toBe("What is b?");
});

it.each<[string, () => void]>([
  ["Close", () => fireEvent.click(within(previewDialog()).getByRole("button", { name: "Close" }))],
  ["Escape", () => fireEvent.keyDown(previewDialog(), { key: "Escape" })],
  // The backdrop is the dialog's parent; it has no role to query by.
  ["a mouse-down on the backdrop", () => fireEvent.mouseDown(previewDialog().parentElement!)],
])("%s closes the Card preview and deletes nothing", (_, close) => {
  const { onDelete } = renderCardsPage([qa("a", 1)]);
  openPreview("a");

  close();

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onDelete).not.toHaveBeenCalled();
});

it.each([
  { type: "qa", card: qa("a", 2), title: "What is a?", answer: ["An answer."] },
  {
    type: "formula",
    card: formula("a", 2, "For example, 6 = 2 · 3."),
    title: "The a formula",
    answer: ["a is a times b.", "a = a · b", "For example, 6 = 2 · 3."],
  },
  {
    type: "formula",
    card: formula("a", 2),
    title: "The a formula",
    answer: ["a is a times b.", "a = a · b"],
  },
  {
    type: "cloze",
    card: cloze("a", 2, "{{A}} tree splits on {{features}}."),
    title: "____ tree splits on ____.",
    answer: ["A tree splits on features."],
  },
  {
    type: "multiple_choice",
    card: { ...multipleChoice("a", 2), answerIndex: 1 },
    title: "Which is a?",
    answer: ["That", "This one."],
  },
  { type: "true_false", card: trueFalse("a", 2), title: "a is true.", answer: ["True"] },
  { type: "true_false", card: trueFalse("a", 2, false), title: "a is true.", answer: ["False"] },
  { type: "numeric", card: numeric("a", 2, "m"), title: "How much is a?", answer: ["5 m"] },
  { type: "numeric", card: numeric("a", 2), title: "How much is a?", answer: ["5"] },
])(
  "a $type preview shows the type name, question, answer $answer, tags, ID and version, Delete, and Edit if the editor makes the type",
  ({ card, title, answer }) => {
    renderCardsPage([card]);

    const preview = openPreview("a");

    expect(preview.getByRole("heading", { level: 3 }).textContent).toBe(title);
    expect(shownTexts(previewDialog())).toEqual([
      "Card preview",
      typeNames[card.type].en,
      title,
      "Answer",
      ...answer,
      "Machine Learning",
      "Decision Tree",
      "a · version 2",
      "Delete",
      ...(["qa", "cloze", "true_false"].includes(card.type) ? ["Edit"] : []),
    ]);
  },
);

it.each(typeCases)(
  "a $card.type row in $language shows its type name $name as a type label, apart from the tags",
  ({ card, language, name }) => {
    renderCardsPage([card], language);

    // Inside the row: the Type select shows the same name.
    const label = within(rows()[0]).getByText(name);
    expect(label.classList.contains("type-label")).toBe(true);
    expect(label.closest(".row-tags")).toBeNull();
  },
);

it.each(typeCases)(
  "a $card.type preview in $language shows its type name $name",
  ({ card, language, name }) => {
    renderCardsPage([card], language);

    fireEvent.click(rowButton("a"));

    const label = within(screen.getByRole("dialog")).getByText(name);
    expect(label.classList.contains("type-label")).toBe(true);
  },
);

it.each(["row", "preview"])(
  "a %s shows domain tags in the domain style, then topic tags in the topic style, even a tag in both",
  (shown) => {
    renderCardsPage([
      tagged(qa("a", 1), ["Statistics", "Machine Learning"], ["Regression", "Statistics"]),
    ]);
    if (shown === "preview") openPreview("a");

    expect(styledTags(shown === "row" ? rows()[0] : previewDialog())).toEqual([
      ["Statistics", "tag-domain"],
      ["Machine Learning", "tag-domain"],
      ["Regression", "tag-topic"],
      ["Statistics", "tag-topic"],
    ]);
  },
);

it("a preview shows every domain tag, then every topic tag", () => {
  renderCardsPage([tagged(qa("a", 1), ["Statistics", "Machine Learning"], ["Regression"])]);

  openPreview("a");

  const texts = shownTexts(previewDialog());
  expect(texts.slice(texts.indexOf("An answer.") + 1, texts.indexOf("a · version 1"))).toEqual([
    "Statistics",
    "Machine Learning",
    "Regression",
  ]);
});

it("in German, a translated qa preview shows its German question and answer", () => {
  renderCardsPage([german(qa("q", 3), { question: "Was ist q?", answer: "Eine Antwort." })], "de");

  fireEvent.click(rowButton("q"));
  const preview = within(screen.getByRole("dialog", { name: "Kartenvorschau" }));

  expect(preview.getByRole("heading", { level: 3 }).textContent).toBe("Was ist q?");
  expect(preview.getByText("Antwort")).toBeTruthy();
  expect(preview.getByText("Eine Antwort.")).toBeTruthy();
  expect(preview.queryByText("An answer.")).toBeNull();
  expect(preview.getByText("q · Version 3")).toBeTruthy();
  expect(preview.getByRole("button", { name: "Löschen" })).toBeTruthy();
});

it.each([
  {
    type: "formula",
    card: german(formula("a", 1, "For example, 6 = 2 · 3."), {
      wordFormula: "a ist a mal b.",
      example: "Zum Beispiel 6 = 2 · 3.",
    }),
    answer: ["a ist a mal b.", "a = a · b", "Zum Beispiel 6 = 2 · 3."],
  },
  {
    type: "cloze",
    card: german(cloze("a", 1), { text: "a hat eine {{Lücke}}." }),
    answer: ["a hat eine Lücke."],
  },
  {
    type: "multiple_choice",
    card: german(multipleChoice("a", 1), {
      options: ["Dieses", "Jenes"],
      explanation: "Dieses hier.",
    }),
    answer: ["Dieses", "Dieses hier."],
  },
  { type: "numeric", card: numeric("a", 1, "m"), answer: ["5 m"] },
])("in German, a $type preview shows the answer $answer", ({ card, answer }) => {
  renderCardsPage([card], "de");

  fireEvent.click(rowButton("a"));
  const texts = shownTexts(screen.getByRole("dialog", { name: "Kartenvorschau" }));

  expect(texts.slice(texts.indexOf("Antwort") + 1, texts.indexOf("Machine Learning"))).toEqual(
    answer,
  );
});

it("in German, a true_false preview shows Wahr", () => {
  renderCardsPage([german(trueFalse("t", 1), { statement: "t ist wahr." })], "de");

  fireEvent.click(rowButton("t"));
  const preview = within(screen.getByRole("dialog", { name: "Kartenvorschau" }));

  expect(preview.getByRole("heading", { level: 3 }).textContent).toBe("t ist wahr.");
  expect(preview.getByText("Wahr")).toBeTruthy();
});

it("the preview closes by itself once its Card is gone", () => {
  const { rerender } = renderCardsPage([qa("a", 1), qa("b", 1)]);
  openPreview("b");

  rerender([qa("a", 1)]);

  expect(screen.queryByRole("dialog")).toBeNull();
});

it("the Delete modal closes by itself once its Card is gone", () => {
  const { rerender } = renderCardsPage([qa("a", 1), qa("b", 1)]);
  fireEvent.click(deleteButton("b"));

  rerender([qa("a", 1)]);

  expect(screen.queryByRole("dialog")).toBeNull();
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
      <CardsPage cards={cards} onDelete={vi.fn()} onDeleteAll={vi.fn()} onSave={vi.fn()}>
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

/** card-1 to card-1000, in that order. */
const thousand = Array.from({ length: 1000 }, (_, i) => qa(`card-${i + 1}`, 1));

/** The IDs card-from to card-to. */
function ids(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => `card-${from + i}`);
}

/** The pixel height of one row in the tests: --virtual-row-height, 6.5rem. */
const ROW_HEIGHT = 104;

/** Scrolls the Card list's box to this many pixels from its top, as the browser does. */
function scrollListTo(top: number) {
  const box = screen.getByRole("list").parentElement!;
  box.scrollTop = top;
  fireEvent.scroll(box);
}

/** Scrolls the Card list so that the row at this index (0 for card-1) is at the top. */
function scrollToRow(row: number) {
  scrollListTo(row * ROW_HEIGHT);
}

/** Scrolls the Card list as far down as it goes: all rows less the 468 px box. */
function scrollToEnd(count: number) {
  scrollListTo(count * ROW_HEIGHT - 468);
}

function deleteButton(id: string) {
  return screen.getByRole<HTMLButtonElement>("button", { name: `Delete ${id}` });
}

it("with 1,000 Cards, lists only the rows in view and three more: card-1 to card-8", () => {
  renderCardsPage(thousand);

  expect(listedIds()).toEqual(ids(1, 8));
  expect(screen.getByText("1000 of 1000 Cards")).toBeTruthy();
});

it("scrolled to the middle, lists the rows there, each knowing its place among all Cards", () => {
  renderCardsPage(thousand);

  scrollToRow(500);

  expect(listedIds()).toEqual(ids(498, 508));
  const row = deleteButton("card-501").closest("li")!;
  expect(row.getAttribute("aria-posinset")).toBe("501");
  expect(row.getAttribute("aria-setsize")).toBe("1000");
});

it("scrolled to the end, lists the last rows, up to card-1000", () => {
  renderCardsPage(thousand);

  scrollToEnd(1000);

  expect(listedIds()).toEqual(ids(993, 1000));
});

it("a focused Delete stays focused while the list scrolls, and the next Delete is the next row's", () => {
  renderCardsPage(thousand);
  scrollToRow(500);
  const focused = deleteButton("card-505");
  focused.focus();

  scrollToRow(501);

  expect(listedIds()).toEqual(ids(499, 509));
  expect(document.activeElement).toBe(focused);
  const deletes = screen.getAllByRole("button", { name: /^Delete card-/ });
  expect(deletes[deletes.indexOf(focused) + 1]).toBe(deleteButton("card-506"));
});

it("Tab goes from a row button to its Delete, then to the next row's button", () => {
  renderCardsPage(thousand);
  scrollToRow(500);

  const buttons = within(screen.getByRole("list")).getAllByRole("button");
  const at = buttons.indexOf(deleteButton("card-505"));

  expect(buttons[at - 1]).toBe(rowButton("card-505"));
  expect(buttons[at + 1]).toBe(rowButton("card-506"));
});

it("a focused row button keeps its row in the list when the list scrolls far from it", () => {
  renderCardsPage(thousand);
  const focused = rowButton("card-3");
  focused.focus();

  scrollToRow(500);

  expect(document.activeElement).toBe(focused);
  expect(listedIds()).toEqual(["card-3", ...ids(498, 508)]);
});

it("the row holding focus stays in the list, in its place, when the list scrolls far from it", () => {
  renderCardsPage(thousand);
  const focused = deleteButton("card-3");
  focused.focus();

  scrollToRow(500);

  expect(document.activeElement).toBe(focused);
  expect(listedIds()).toEqual(["card-3", ...ids(498, 508)]);
});

it("when focus moves to another row, that row stays in the list instead", () => {
  renderCardsPage(thousand);
  deleteButton("card-3").focus();
  deleteButton("card-4").focus();

  scrollToRow(500);

  expect(listedIds()).toEqual(["card-4", ...ids(498, 508)]);
});

it("once focus leaves it, a row far from the view goes from the list", () => {
  renderCardsPage(thousand);
  deleteButton("card-3").focus();
  scrollToRow(500);

  // act, as React does for a browser event: blur() alone leaves React's update pending.
  act(() => deleteButton("card-3").blur());

  expect(listedIds()).toEqual(ids(498, 508));
});

it.each([
  { by: "a search", filter: () => search("card") },
  { by: "a Type", filter: () => pickType("qa") },
  { by: "a Tag", filter: () => pickTag("Machine Learning") },
])("$by scrolls the list back to the top", ({ filter }) => {
  renderCardsPage(thousand);
  scrollToRow(500);

  filter();

  expect(screen.getByText("1000 of 1000 Cards")).toBeTruthy();
  expect(listedIds()).toEqual(ids(1, 8));
});

it("a change of the Cards keeps the scroll position, so deleting a row leaves the rows around it", () => {
  const { rerender } = renderCardsPage(thousand);
  scrollToRow(500);

  rerender(thousand.filter((card) => card.id !== "card-501"));

  expect(listedIds()).toEqual([...ids(498, 500), ...ids(502, 509)]);
});

it("Create Card in the heading opens the Card editor; creating opens it at once", () => {
  renderCardsPage([]);
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Create Card" }));
  expect(screen.getByRole("dialog", { name: "Create Card" })).toBeTruthy();
  cleanup();

  render(
    <CardsPage cards={[]} onDelete={vi.fn()} onDeleteAll={vi.fn()} onSave={vi.fn()} creating />,
  );
  expect(screen.getByRole("dialog", { name: "Create Card" })).toBeTruthy();
});

it.each([
  { card: qa("a", 1), edit: true },
  { card: cloze("a", 1), edit: true },
  { card: trueFalse("a", 1), edit: true },
  { card: formula("a", 1), edit: false },
  { card: multipleChoice("a", 1), edit: false },
  { card: numeric("a", 1), edit: false },
])("the preview of a $card.type Card has Edit: $edit", ({ card, edit }) => {
  renderCardsPage([card]);

  const preview = openPreview("a");

  expect(preview.queryByRole("button", { name: "Edit" }) !== null).toBe(edit);
});

it("Edit opens the Card editor for that Card; Save changes saves the next version, shows Card saved. and its preview", async () => {
  const { onSave, rerender } = renderCardsPage([qa("a", 1), qa("b", 1)]);

  fireEvent.click(openPreview("b").getByRole("button", { name: "Edit" }));
  const editor = within(screen.getByRole("dialog", { name: "Edit Card" }));
  expect(screen.queryByRole("dialog", { name: "Card preview" })).toBeNull();
  fireEvent.change(editor.getByLabelText("Answer", { exact: true }), {
    target: { value: "Changed." },
  });
  fireEvent.click(editor.getByRole("button", { name: "Save changes" }));
  const saved = { ...qa("b", 2, "Changed.") };
  expect(onSave).toHaveBeenCalledWith(saved);
  rerender([qa("a", 1), saved]);

  expect((await screen.findByRole("status")).textContent).toBe("Card saved.");
  expect(screen.queryByRole("dialog", { name: "Edit Card" })).toBeNull();
  expect(within(previewDialog()).getByText("b · version 2")).toBeTruthy();
});

it("a failed save closes the editor and shows no Card saved.", async () => {
  const { onSave } = renderCardsPage([qa("a", 1)], "en", true, false);

  fireEvent.click(openPreview("a").getByRole("button", { name: "Edit" }));
  const editor = within(screen.getByRole("dialog", { name: "Edit Card" }));
  fireEvent.click(editor.getByRole("button", { name: "Save changes" }));

  await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("Card saved.")).toBeNull();
});
