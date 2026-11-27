import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { expect, it } from "vitest";
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
  deleteButton,
  openPreview,
  previewDialog,
  renderCardsPage,
  rowButton,
  rows,
  shownTexts,
  typeNames,
} from "./test/cards.page.helpers";

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
  "a $type preview shows the type name, question, answer $answer, tags, ID and version, Delete, Edit for the editable types, Add to current Session and New Session",
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
      "Add to current Session",
      "New Session",
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
