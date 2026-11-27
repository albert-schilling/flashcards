import { fireEvent, render, screen } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { expect, it, vi } from "vitest";
import { App } from "./App";
import { addReview, loadReviews } from "./storage";
import {
  blockStorage,
  download,
  expectListed,
  goHome,
  openCards,
  pick,
  upload,
  uploaded,
} from "./test/app.helpers";
import { qa, review } from "./test/cards.fixtures";

it("downloads the Cards as a Deck that uploads again unchanged", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 2));

  const file = await download("Download Cards");

  expect(file.name).toBe("deck.json");
  pick(file, "Upload Deck");
  await screen.findByText(/0 added, 0 updated, 2 unchanged/);
});

it("downloads every Review, and the file restores them in an empty browser", async () => {
  const reviews = [
    review("a", 1, "2026-11-15T10:00:00.000Z"),
    review("a", 1, "2026-11-15T10:05:00.000Z", false),
    review("b", 2, "2026-11-15T10:01:00.000Z"),
  ];
  for (const each of reviews) await addReview(each);
  const { unmount } = render(<App />);

  const file = await download("Download Review log");

  expect(file.name).toBe("review-log.json");
  expect(JSON.parse(await file.text())).toEqual({ reviews });
  unmount();
  globalThis.indexedDB = new IDBFactory();
  render(<App />);
  pick(file, "Upload Review log");
  await screen.findByText(/3 added, 0 skipped/);
  expect(await loadReviews()).toEqual(reviews);
  pick(file, "Upload Review log");
  await screen.findByText(/0 added, 3 skipped/);
  expect(await loadReviews()).toEqual(reviews);
});

it("shows the errors of an invalid Review log", async () => {
  render(<App />);
  const text = JSON.stringify({ reviews: [review("a", 0, "2026-11-15T10:00:00.000Z")] });

  pick(new File([text], "review-log.json", { type: "application/json" }), "Upload Review log");

  await screen.findByText(/File rejected/);
  expect(screen.getByText(/review 1: cardVersion: /)).toBeTruthy();
  expect(await loadReviews()).toEqual([]);
});

it("shows No download yet, which only a Review log download resets", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  openCards();
  expect(screen.getByText("No download yet")).toBeTruthy();

  await download("Download Cards");
  expect(screen.getByText("No download yet")).toBeTruthy();

  await download("Download Review log");
  await screen.findByText("Days since the last download: 0");
  expect(screen.queryByText("No download yet")).toBeNull();
});

it("the Files panel keeps the report and the days since the last download after going Home and back", async () => {
  render(<App />);
  upload(qa("a", 1));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);
  await download("Download Review log");
  await screen.findByText("Days since the last download: 0");

  goHome();
  expect(screen.queryByText(/1 added, 0 updated, 0 unchanged/)).toBeNull();
  openCards();

  expect(screen.getByText(/1 added, 0 updated, 0 unchanged/)).toBeTruthy();
  expect(screen.getByText("Days since the last download: 0")).toBeTruthy();
});

it("shows the days since the last download after a reload", async () => {
  // Fake only the clock: Testing Library waits with real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2026-11-12T10:00:00.000Z"));
    const first = render(<App />);
    await download("Download Review log");
    await screen.findByText("Days since the last download: 0");
    first.unmount();

    // Only whole 24-hour periods count.
    vi.setSystemTime(new Date("2026-11-15T09:59:00.000Z"));
    const second = render(<App />);
    openCards();
    await screen.findByText("Days since the last download: 2");
    second.unmount();

    vi.setSystemTime(new Date("2026-11-15T10:00:00.000Z"));
    render(<App />);
    openCards();
    await screen.findByText("Days since the last download: 3");
  } finally {
    vi.useRealTimers();
  }
});

it.each(["Download Cards", "Download Review log"])(
  "shows an error and downloads nothing when %s can't read storage",
  async (button) => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      render(<App />);
      await uploaded(qa("a", 1));
      openCards();
      blockStorage();

      fireEvent.click(screen.getByRole("button", { name: button }));

      expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
      expect(click).not.toHaveBeenCalled();
      expect(screen.getByText("No download yet")).toBeTruthy();
    } finally {
      click.mockRestore();
    }
  },
);

it("a Deck upload that finishes after a newer Review log upload keeps the Review log report", async () => {
  render(<App />);
  const deck = JSON.stringify({ cards: [qa("a", 1)] });
  const slow = new File([deck], "deck.json", { type: "application/json" });
  // Hold the Deck open, so the Review log upload finishes first.
  let finishReading = () => {};
  slow.text = () =>
    new Promise((resolve) => {
      finishReading = () => resolve(deck);
    });
  pick(slow, "Upload Deck");
  const text = JSON.stringify({ reviews: [review("a", 1, "2026-11-15T10:00:00.000Z")] });
  pick(new File([text], "review-log.json", { type: "application/json" }), "Upload Review log");
  await screen.findByText(/1 added, 0 skipped/);

  finishReading();

  await expectListed(qa("a", 1));
  expect(screen.getByText(/1 added, 0 skipped/)).toBeTruthy();
  expect(screen.queryByText(/1 added, 0 updated, 0 unchanged/)).toBeNull();
});
