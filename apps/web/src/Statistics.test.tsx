import { fireEvent, render, screen, within } from "@testing-library/react";
import { ArrowLeft } from "lucide-react";
import { expect, it } from "vitest";
import { App } from "./App";
import { addReview } from "./storage";
import {
  blockStorage,
  expectListed,
  goTo,
  levelOneHeadings,
  startButton,
  uploaded,
} from "./test/app.helpers";
import { qa, tagged } from "./test/cards.fixtures";
import { home, overview, rows } from "./test/statistics.helpers";
import { showsIcon } from "./test/study.helpers";

/** The width of each Share right bar in the table with this name, row by row; the bars are decoration. */
function bars(name: string) {
  const table = screen.getByRole("table", { name });
  const spans = table.querySelectorAll<HTMLElement>('.mini-bar[aria-hidden="true"] > span');
  return Array.from(spans, (bar) => bar.style.width);
}

it("Statistics shows the figures from the Review log, and Back goes back", async () => {
  const review = { cardId: "a", cardVersion: 2, durationMs: 3000 };
  await addReview({ ...review, answeredAt: "2026-11-13T10:00:00.000Z", right: true });
  await addReview({ ...review, answeredAt: "2026-11-15T10:00:00.000Z", right: false });
  await addReview({ ...review, answeredAt: "2026-11-14T10:00:00.000Z", right: true });
  // A later Review of the older version doesn't count.
  await addReview({
    ...review,
    cardVersion: 1,
    answeredAt: "2026-11-16T10:00:00.000Z",
    right: true,
  });
  render(<App />);
  await uploaded(tagged(qa("a", 2), ["Statistics"], ["Regression"]), qa("b", 1));

  fireEvent.click(home().getByRole("button", { name: "Statistics" }));

  await screen.findByRole("table", { name: "Cards" });
  expect(screen.queryByLabelText("Upload Deck")).toBeNull();
  expect(levelOneHeadings()).toEqual(["Statistics"]);
  expect(screen.getByText("Learning history")).toBeTruthy();
  expect(
    screen.getByText("A clear view of every Review, from individual Cards to broader Tags."),
  ).toBeTruthy();
  expect(showsIcon(screen.getByRole("button", { name: "Back" }), ArrowLeft)).toBe(true);
  // The Review of the older version is not counted.
  expect(overview()).toEqual([
    ["2", "Cards"],
    ["3", "Reviews"],
    ["67%", "Share right"],
  ]);
  const panels = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
  expect(panels).toEqual(["Cards", "Domain tags", "Topic tags"]);
  const cardsTable = within(screen.getByRole("table", { name: "Cards" }));
  expect(cardsTable.getAllByRole("rowheader").map((th) => th.textContent)).toEqual(["a", "b"]);
  expect(bars("Cards")).toEqual(["67%", "0%"]);
  expect(bars("Domain tags")).toEqual(["0%", "67%"]);
  expect(rows("Cards")).toEqual([
    ["Card", "Reviews", "Share right", "Last reviewed"],
    ["a", "3", "67%", "11/15/2026"],
    ["b", "0", "–", "never"],
  ]);
  expect(rows("Domain tags")).toEqual([
    ["Tag", "Cards", "Reviews", "Share right"],
    ["Machine Learning", "1", "0", "–"],
    ["Statistics", "1", "3", "67%"],
  ]);
  expect(rows("Topic tags")).toEqual([
    ["Tag", "Cards", "Reviews", "Share right"],
    ["Decision Tree", "1", "0", "–"],
    ["Regression", "1", "3", "67%"],
  ]);

  fireEvent.click(screen.getByRole("button", { name: "Back" }));

  expect(startButton()).toBeTruthy();
  await expectListed(qa("b", 1));
});

it("Statistics with no Cards shows 0 Cards, 0 Reviews and no share", async () => {
  render(<App />);

  // Home shows no Statistics button with no Cards, so this goes through the navigation.
  goTo("Statistics");

  await screen.findByRole("table", { name: "Cards" });
  expect(overview()).toEqual([
    ["0", "Cards"],
    ["0", "Reviews"],
    ["–", "Share right"],
  ]);
  expect(rows("Cards")).toEqual([["Card", "Reviews", "Share right", "Last reviewed"]]);
  expect(rows("Domain tags")).toEqual([["Tag", "Cards", "Reviews", "Share right"]]);
  expect(rows("Topic tags")).toEqual([["Tag", "Cards", "Reviews", "Share right"]]);
});

it("shows an error when the Review log can't be loaded", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  blockStorage();

  fireEvent.click(home().getByRole("button", { name: "Statistics" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(startButton()).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});
