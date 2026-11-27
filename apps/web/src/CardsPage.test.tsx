import type { TCard } from "@flashcards/cards";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { expect, it, vi } from "vitest";
import { CardsPage } from "./CardsPage";
import { LanguageContext, type TLanguage } from "./language.context";
import {
  cloze,
  formula,
  fullFormula,
  german,
  multipleChoice,
  numeric,
  qa,
  tagged,
  trueFalse,
} from "./test/cards.fixtures";

/** Renders the Cards page with these Cards in this language and returns its callback mocks, and `rerender` to show other Cards on the same page. `deletes` is what onDelete resolves to: whether App deleted the Card; onSave resolves to true unless a test changes it. */
function renderCardsPage(cards: TCard[], language: TLanguage = "en", deletes = true) {
  const onDelete = vi.fn().mockResolvedValue(deletes);
  const onDeleteAll = vi.fn();
  const onSave = vi.fn().mockResolvedValue(true);
  const page = (cards: TCard[]) => (
    <LanguageContext.Provider value={language}>
      <CardsPage cards={cards} onDelete={onDelete} onDeleteAll={onDeleteAll} onSave={onSave} />
    </LanguageContext.Provider>
  );
  const { rerender } = render(page(cards));
  return {
    onDelete,
    onDeleteAll,
    onSave,
    rerender: (cards: TCard[]) => rerender(page(cards)),
  };
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
  "a $type preview shows the type name, question, answer $answer, tags, ID and version, Delete, and Edit for the editable types",
  ({ card, title, answer }) => {
    const editable = [
      "qa",
      "cloze",
      "true_false",
      "formula",
      "numeric",
      "multiple_choice",
    ].includes(card.type);
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
      ...(editable ? ["Edit"] : []),
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

it("the heading holds Create Card with a hidden plus icon, which opens the Card editor", () => {
  renderCardsPage([qa("a", 1)]);
  const create = screen.getByRole("button", { name: "Create Card" });
  expect(create.closest(".cards-page-heading")).toBeTruthy();
  expect(create.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

  fireEvent.click(create);

  expect(screen.getByRole("dialog", { name: "Create Card" })).toBeTruthy();
});

it.each([qa("a", 1), cloze("a", 1), trueFalse("a", 1), formula("a", 1), numeric("a", 1)])(
  "a $type preview has Edit, with a hidden icon, after Delete",
  (card) => {
    renderCardsPage([card]);

    const buttons = openPreview("a").getAllByRole("button");

    expect(buttons.slice(-2).map((button) => button.textContent)).toEqual(["Delete", "Edit"]);
    expect(buttons.at(-1)!.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  },
);

it.each([
  {
    card: german(cloze("a", 1), { text: "a hat eine {{Lücke}}." }),
    fields: { Type: "cloze", Text: "a has a {{gap}}.", "Text (German)": "a hat eine {{Lücke}}." },
  },
  {
    card: german(trueFalse("a", 1, false), { statement: "a ist wahr." }),
    fields: { Type: "true_false", Statement: "a is true.", "Statement (German)": "a ist wahr." },
  },
  {
    card: fullFormula("a", 1),
    fields: {
      Type: "formula",
      Name: "The a formula",
      "Word formula": "a is a times b.",
      "Read aloud": "a equals a times b",
      Example: "2 · 3 = 6",
      Formula: "a = a · b",
      LaTeX: "a = a \\cdot b",
      "Name (German)": "Die a-Formel",
      "Word formula (German)": "a ist a mal b.",
      "Read aloud (German)": "a gleich a mal b",
      "Example (German)": "zwei mal drei",
    },
  },
  {
    card: german(numeric("a", 1, "m"), { question: "Wie viel ist a?" }),
    fields: {
      Type: "numeric",
      Question: "How much is a?",
      Answer: "5",
      "Allowed error": "0.01",
      Unit: "m",
      "Question (German)": "Wie viel ist a?",
    },
  },
  {
    card: german(multipleChoice("a", 1), {
      question: "Welches ist a?",
      options: ["Dies", "Das"],
      explanation: "Dieses.",
    }),
    fields: {
      Type: "multiple_choice",
      Question: "Which is a?",
      Explanation: "This one.",
      "Option 1": "This",
      "Option 1 (German)": "Dies",
      "Option 2": "That",
      "Option 2 (German)": "Das",
      "Question (German)": "Welches ist a?",
      "Explanation (German)": "Dieses.",
    },
  },
])("Edit in a $card.type preview opens the editor with the Card's fields", ({ card, fields }) => {
  renderCardsPage([card]);

  fireEvent.click(openPreview("a").getByRole("button", { name: "Edit" }));

  const editor = within(screen.getByRole("dialog", { name: "Edit Card" }));
  for (const [label, value] of Object.entries(fields)) {
    expect(editor.getByLabelText<HTMLInputElement>(label).value).toBe(value);
  }
  if (card.type === "true_false") {
    const answer = editor.getByLabelText<HTMLSelectElement>("Answer");
    expect(answer.selectedOptions[0].textContent).toBe("False");
  }
  if (card.type === "multiple_choice") {
    expect(editor.getByLabelText<HTMLInputElement>("Option 1 is right").checked).toBe(true);
    expect(editor.getByLabelText<HTMLInputElement>("Option 2 is right").checked).toBe(false);
  }
  expect(editor.getByRole("button", { name: "Save changes" })).toBeTruthy();
});

function editorDialog(title = "Create Card") {
  return screen.getByRole("dialog", { name: title });
}

/** Presses Create Card in the heading and returns queries inside the Card editor. */
function openCreate(name = "Create Card") {
  fireEvent.click(screen.getByRole("button", { name }));
  return within(editorDialog(name));
}

function fillField(editor: ReturnType<typeof within>, label: string, value: string) {
  fireEvent.change(editor.getByLabelText(label), { target: { value } });
}

/** The texts that describe this field (its hint, then its error), from aria-describedby. */
function described(field: HTMLElement): string[] {
  const ids = field.getAttribute("aria-describedby")?.split(" ") ?? [];
  return ids.map((id) => document.getElementById(id)!.textContent!);
}

it.each<[string, () => void]>([
  ["Close", () => fireEvent.click(within(editorDialog()).getByRole("button", { name: "Close" }))],
  ["Escape", () => fireEvent.keyDown(editorDialog(), { key: "Escape" })],
  ["a mouse-down on the backdrop", () => fireEvent.mouseDown(editorDialog().parentElement!)],
])("%s closes the Card editor and saves nothing", (_, close) => {
  const { onSave } = renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fillField(editor, "Question", "What is b?");

  close();

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onSave).not.toHaveBeenCalled();
});

it("after an Edit is cancelled, Create Card opens an empty editor whose ID follows the question", () => {
  renderCardsPage([german(qa("a", 1), { question: "Was ist a?" })]);
  fireEvent.click(openPreview("a").getByRole("button", { name: "Edit" }));
  fireEvent.click(within(editorDialog("Edit Card")).getByRole("button", { name: "Cancel" }));

  const editor = openCreate();

  expect(editor.getByLabelText<HTMLTextAreaElement>("Question").value).toBe("");
  expect(editor.getByLabelText<HTMLTextAreaElement>("Question (German)").value).toBe("");
  expect(editor.getByLabelText<HTMLInputElement>("Lesson").value).toBe("");
  const id = editor.getByLabelText<HTMLInputElement>("ID");
  expect(id.disabled).toBe(false);
  fillField(editor, "Question", "What is b?");
  expect(id.value).toBe("what-is-b");
});

it("the editor's fields show their hints and tag placeholders, and an error follows the hint", () => {
  renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "cloze" } });
  const domain = editor.getByLabelText<HTMLInputElement>("Domain tags");
  const topic = editor.getByLabelText<HTMLInputElement>("Topic tags");

  expect(described(editor.getByLabelText("Text"))).toEqual([
    "Put each gap in double braces, like {{gap}}.",
  ]);
  expect(described(editor.getByLabelText("Text (German)"))).toEqual([
    "Optional. Without it, the English text shows.",
  ]);
  expect(described(domain)).toEqual(["Separate Tags with commas."]);
  expect(described(topic)).toEqual(["Separate Tags with commas."]);
  expect(domain.placeholder).toBe("Machine Learning");
  expect(topic.placeholder).toBe("Decision Tree");
  expect(described(editor.getByLabelText("Lesson"))).toEqual([]);
  expect(described(editor.getByLabelText("ID"))).toEqual([
    "Lowercase words joined by dots or hyphens.",
  ]);

  fillField(editor, "Text", "A leaf predicts the mean.");
  fireEvent.click(editor.getByRole("button", { name: "Create Card" }));

  expect(described(editor.getByLabelText("Text"))).toEqual([
    "Put each gap in double braces, like {{gap}}.",
    "Add a gap in double braces, like {{gap}}.",
  ]);
});

it("the formula fields are text areas with the control style; Read aloud, Example and LaTeX say they are optional", () => {
  renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "formula" } });
  const germanHint = ["Optional. Without it, the English text shows."];
  const hints = {
    Name: [],
    "Word formula": [],
    "Read aloud": ["Optional."],
    Example: ["Optional."],
    Formula: [],
    LaTeX: ["Optional."],
    "Name (German)": germanHint,
    "Word formula (German)": germanHint,
    "Read aloud (German)": germanHint,
    "Example (German)": germanHint,
  };

  for (const [label, hint] of Object.entries(hints)) {
    const field = editor.getByLabelText(label);
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.classList.contains("control")).toBe(true);
    expect(field.closest(".field")).toBeTruthy();
    expect(described(field)).toEqual(hint);
  }
});

it("the numeric fields have the control style: Answer and Allowed error are number inputs without a hint, Allowed error starts at 0, and Unit is a text input that says it is optional", () => {
  renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "numeric" } });
  const fields = {
    Answer: { type: "number", hint: [] },
    "Allowed error": { type: "number", hint: [] },
    Unit: { type: "text", hint: ["Optional."] },
  };

  for (const [label, { type, hint }] of Object.entries(fields)) {
    const field = editor.getByLabelText<HTMLInputElement>(label);
    expect(field.tagName).toBe("INPUT");
    expect(field.type).toBe(type);
    expect(field.getAttribute("step")).toBe(type === "number" ? "any" : null);
    expect(field.classList.contains("control")).toBe(true);
    expect(field.closest(".field")).toBeTruthy();
    expect(described(field)).toEqual(hint);
  }
  expect(editor.getByLabelText<HTMLInputElement>("Answer").value).toBe("");
  expect(editor.getByLabelText<HTMLInputElement>("Allowed error").value).toBe("0");
  expect(described(editor.getByLabelText("Question (German)"))).toEqual([
    "Optional. Without it, the English text shows.",
  ]);
});

it("the multiple_choice options are one-line inputs with the control style and no hint of their own, under the Options fieldset's one hint; Remove is an icon button titled like its name", () => {
  renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "multiple_choice" } });
  const fieldset = editor.getByRole("group", { name: "Options" });

  expect(described(fieldset)).toEqual(["Mark the right option. German options: fill all or none."]);
  for (const label of ["Option 1", "Option 1 (German)", "Option 2", "Option 2 (German)"]) {
    const field = editor.getByLabelText<HTMLInputElement>(label);
    expect(field.tagName).toBe("INPUT");
    expect(field.type).toBe("text");
    expect(field.classList.contains("control")).toBe(true);
    expect(field.closest(".field")).toBeTruthy();
    expect(described(field)).toEqual([]);
  }
  expect(editor.getByLabelText("Explanation").tagName).toBe("TEXTAREA");
  const remove = editor.getByRole("button", { name: "Remove option 2" });
  expect(remove.classList.contains("icon-button")).toBe(true);
  expect(remove.title).toBe("Remove option 2");
});

it("an option marked right stays marked while option texts are typed and an option is added", () => {
  renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "multiple_choice" } });
  const right = (n: number) => editor.getByLabelText<HTMLInputElement>(`Option ${n} is right`);
  fireEvent.click(right(2));

  fillField(editor, "Option 1", "The root");
  fillField(editor, "Option 2 (German)", "Ein Blatt");
  fireEvent.click(editor.getByRole("button", { name: "Add option" }));

  expect([1, 2, 3].map((n) => right(n).checked)).toEqual([false, true, false]);
});

it("in German, the Options fieldset, its rows and buttons read in German", () => {
  renderCardsPage([qa("a", 1)], "de");
  const editor = openCreate("Karte erstellen");
  fireEvent.change(editor.getByLabelText("Typ"), { target: { value: "multiple_choice" } });

  expect(described(editor.getByRole("group", { name: "Optionen" }))).toEqual([
    "Markiere die richtige Option. Deutsche Optionen: alle oder keine.",
  ]);
  expect(editor.getByLabelText("Erklärung")).toBeTruthy();
  expect(editor.getByLabelText("Option 1 (Deutsch)")).toBeTruthy();
  expect(editor.getByLabelText("Option 1 ist richtig")).toBeTruthy();
  expect(editor.getByRole("button", { name: "Option 1 entfernen" })).toBeTruthy();
  expect(editor.getByRole("button", { name: "Option hinzufügen" })).toBeTruthy();
});

it("each field problem shows its own text: an empty field, a cloze without a gap, an ID that is not lowercase words", () => {
  const { onSave } = renderCardsPage([qa("a", 1)]);
  const editor = openCreate();
  fireEvent.change(editor.getByLabelText("Type"), { target: { value: "cloze" } });
  fillField(editor, "Text", "A leaf predicts the mean.");
  fillField(editor, "Domain tags", "Machine Learning");
  fillField(editor, "Topic tags", "Decision Tree");
  fillField(editor, "ID", "Bad ID");

  fireEvent.click(editor.getByRole("button", { name: "Create Card" }));

  expect(described(editor.getByLabelText("Text")).at(-1)).toBe(
    "Add a gap in double braces, like {{gap}}.",
  );
  expect(described(editor.getByLabelText("Lesson"))).toEqual(["This field can't be empty."]);
  expect(described(editor.getByLabelText("ID")).at(-1)).toBe(
    "Use lowercase words joined by dots or hyphens.",
  );
  expect(onSave).not.toHaveBeenCalled();
});

it("in German, the Card editor, its errors and the saved notice read in German", async () => {
  const { onSave } = renderCardsPage([qa("a", 1)], "de");
  const editor = openCreate("Karte erstellen");
  const labels = [...editorDialog("Karte erstellen").querySelectorAll("label")].map(
    (label) => label.textContent,
  );
  expect(labels).toEqual([
    "Typ",
    "Frage",
    "Antwort",
    "Frage (Deutsch)",
    "Antwort (Deutsch)",
    "Fachgebiet-Tags",
    "Themen-Tags",
    "Lektion",
    "ID",
  ]);

  fireEvent.click(editor.getByRole("button", { name: "Karte erstellen" }));
  expect(described(editor.getByLabelText("Lektion"))).toEqual([
    "Dieses Feld darf nicht leer sein.",
  ]);

  fillField(editor, "Frage", "What is b?");
  fillField(editor, "Antwort", "B.");
  fillField(editor, "Fachgebiet-Tags", "Machine Learning");
  fillField(editor, "Themen-Tags", "Decision Tree");
  fillField(editor, "Lektion", "lesson-04");
  fireEvent.click(editor.getByRole("button", { name: "Karte erstellen" }));

  expect((await screen.findByRole("status")).textContent).toBe("Karte gespeichert.");
  expect(onSave).toHaveBeenCalledTimes(1);
});

it("a failed save after a deleted Card removes Card deleted. and opens no preview", async () => {
  const { onSave } = renderCardsPage([qa("a", 1), qa("b", 1)]);
  onSave.mockResolvedValue(false);
  confirmDelete("a");
  await screen.findByRole("status");
  const editor = openCreate();
  fillField(editor, "Question", "What is c?");
  fillField(editor, "Answer", "C.");
  fillField(editor, "Domain tags", "Machine Learning");
  fillField(editor, "Topic tags", "Decision Tree");
  fillField(editor, "Lesson", "lesson-04");

  fireEvent.click(editor.getByRole("button", { name: "Create Card" }));
  // Let the page handle onSave's result before looking.
  await act(async () => {});

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});
