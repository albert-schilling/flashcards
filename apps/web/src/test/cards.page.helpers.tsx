// Renders the Cards page alone, with mock callbacks, and finds its rows, filters, preview and editor.
import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, vi, type Mock } from "vitest";
import { CardsPage } from "../CardsPage";
import { LanguageContext, type TLanguage } from "../language.context";

/** Renders the Cards page with these Cards in this language and returns its callback mocks, and `rerender` to show other Cards on the same page. `deletes` is what onDelete resolves to: whether App deleted the Card; onSave resolves to true unless a test changes it. A Session runs, with none of the Cards in it. */
export function renderCardsPage(
  cards: TCard[],
  language: TLanguage = "en",
  deletes = true,
): { onDelete: Mock; onDeleteAll: Mock; onSave: Mock; rerender: (cards: TCard[]) => void } {
  const onDelete = vi.fn().mockResolvedValue(deletes);
  const onDeleteAll = vi.fn();
  const onSave = vi.fn().mockResolvedValue(true);
  const onAddToSession = vi.fn();
  const onNewSession = vi.fn();
  const page = (cards: TCard[]) => (
    <LanguageContext.Provider value={language}>
      <CardsPage
        cards={cards}
        onDelete={onDelete}
        onDeleteAll={onDeleteAll}
        onSave={onSave}
        onAddToSession={onAddToSession}
        onNewSession={onNewSession}
      />
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

export function rows() {
  return screen.getAllByRole("listitem");
}

/** The IDs of the listed Cards, in order; none when no list shows. A row shows its type name, title, then ID. */
export function listedIds(): string[] {
  return screen.queryAllByRole("listitem").map((row) => shownTexts(row)[2]);
}

/** Each Card type's name in English and German, in the Type select's order. */
export const typeNames: Record<TCard["type"], { en: string; de: string }> = {
  qa: { en: "Question & answer", de: "Frage & Antwort" },
  multiple_choice: { en: "Multiple choice", de: "Multiple Choice" },
  formula: { en: "Formula", de: "Formel" },
  numeric: { en: "Numeric", de: "Numerisch" },
  cloze: { en: "Fill the gap", de: "Lückentext" },
  true_false: { en: "True or false", de: "Wahr oder falsch" },
};

export function search(query: string, label = "Search Cards") {
  fireEvent.change(screen.getByRole("searchbox", { name: label }), { target: { value: query } });
}

export function typeSelect(label = "Type") {
  return screen.getByLabelText<HTMLSelectElement>(label);
}

export function tagSelect() {
  return screen.getByLabelText<HTMLSelectElement>("Tag");
}

export function pickType(type: string) {
  fireEvent.change(typeSelect(), { target: { value: type } });
}

export function pickTag(tag: string) {
  fireEvent.change(tagSelect(), { target: { value: tag } });
}

/** The texts a reader sees in this element, in order, one entry per text node. */
export function shownTexts(element: HTMLElement): string[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const texts: string[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent!.trim();
    if (text) texts.push(text);
  }
  return texts;
}

export function deleteAllButton() {
  return screen.getByRole<HTMLButtonElement>("button", { name: "Delete all Cards" });
}

/** The button of this Card's row that opens its preview: the row's other button, beside Delete. Fails while the row has no such button. */
export function rowButton(id: string): HTMLButtonElement {
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

export function previewDialog() {
  return screen.getByRole("dialog", { name: "Card preview" });
}

/** Opens this Card's preview from its row and returns queries inside it. */
export function openPreview(id: string) {
  fireEvent.click(rowButton(id));
  return within(previewDialog());
}

/** Presses this Card's row Delete, then Delete in the modal that asks first. */
export function confirmDelete(id: string) {
  fireEvent.click(deleteButton(id));
  const modal = within(screen.getByRole("dialog", { name: "Delete this Card?" }));
  fireEvent.click(modal.getByRole("button", { name: "Delete" }));
}

export function deleteButton(id: string) {
  return screen.getByRole<HTMLButtonElement>("button", { name: `Delete ${id}` });
}

export function editorDialog(title = "Create Card") {
  return screen.getByRole("dialog", { name: title });
}

/** Presses Create Card in the heading and returns queries inside the Card editor. */
export function openCreate(name = "Create Card") {
  fireEvent.click(screen.getByRole("button", { name }));
  return within(editorDialog(name));
}

export function fillField(editor: ReturnType<typeof within>, label: string, value: string) {
  fireEvent.change(editor.getByLabelText(label), { target: { value } });
}

/** The texts that describe this field (its hint, then its error), from aria-describedby. */
export function described(field: HTMLElement): string[] {
  const ids = field.getAttribute("aria-describedby")?.split(" ") ?? [];
  return ids.map((id) => document.getElementById(id)!.textContent!);
}
