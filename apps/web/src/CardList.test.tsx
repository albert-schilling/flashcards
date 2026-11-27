import { act, fireEvent, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { qa } from "./test/cards.fixtures";
import {
  deleteButton,
  listedIds,
  pickTag,
  pickType,
  renderCardsPage,
  rowButton,
  search,
} from "./test/cards.page.helpers";

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
