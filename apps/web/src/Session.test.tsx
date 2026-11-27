import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { loadReviews } from "./storage";
import {
  answer,
  blockStorage,
  deleteFromRow,
  expectListed,
  expectNotListed,
  goHome,
  goTo,
  isCurrent,
  openCards,
  startButton,
  startSession,
  uploaded,
} from "./test/app.helpers";
import { multipleChoice, qa, tagged } from "./test/cards.fixtures";
import { openPreview } from "./test/editor.helpers";

it("reveals the answer, and Knew it appends a right Review", async () => {
  // Fake only the clock: Testing Library waits with real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    render(<App />);
    await uploaded(qa("ml.trees.depth", 1, "As deep as needed."));
    vi.setSystemTime(new Date("2026-11-15T10:00:00.000Z"));

    startSession();
    await screen.findByText("What is ml.trees.depth?");
    expect(screen.queryByText("As deep as needed.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    expect(screen.getByText("As deep as needed.")).toBeTruthy();
    vi.setSystemTime(new Date("2026-11-15T10:00:04.000Z"));
    fireEvent.click(screen.getByRole("button", { name: "Knew it" }));

    await waitFor(async () =>
      expect(await loadReviews()).toEqual([
        {
          cardId: "ml.trees.depth",
          cardVersion: 1,
          answeredAt: "2026-11-15T10:00:04.000Z",
          right: true,
          durationMs: 4000,
        },
      ]),
    );
  } finally {
    vi.useRealTimers();
  }
});

it("times each Card from when it is shown, not from the start of the Session", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    render(<App />);
    await uploaded(qa("a", 1), qa("b", 1));
    vi.setSystemTime(new Date("2026-11-15T10:00:00.000Z"));

    startSession();
    fireEvent.click(await screen.findByRole("button", { name: "Reveal" }));
    vi.setSystemTime(new Date("2026-11-15T10:00:04.000Z"));
    fireEvent.click(screen.getByRole("button", { name: "Knew it" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reveal" }));
    vi.setSystemTime(new Date("2026-11-15T10:00:10.000Z"));
    fireEvent.click(screen.getByRole("button", { name: "Knew it" }));

    await waitFor(async () =>
      expect(
        (await loadReviews()).map((review) => review.durationMs).sort((x, y) => x - y),
      ).toEqual([4000, 6000]),
    );
  } finally {
    vi.useRealTimers();
  }
});

it("a new Card starts unanswered", async () => {
  render(<App />);
  await uploaded(multipleChoice("a", 1), multipleChoice("b", 1));

  startSession();
  fireEvent.click(await screen.findByRole("button", { name: "That" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  expect(screen.queryByText("Wrong.")).toBeNull();
  expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "This" }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "This" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  // The first Card, answered wrong, comes back.
  fireEvent.click(screen.getByRole("button", { name: "This" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("3 answered, 2 right");
});

it("the summary counts Cards answered and right, and Done goes back", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1), qa("c", 1));

  startSession();
  await answer(true);
  await answer(false);
  await answer(true);
  // The Card answered wrong comes back.
  await answer(true);

  await screen.findByText(/4 answered, 3 right/);
  expect(screen.getByRole("heading", { level: 1, name: "4 answered, 3 right" })).toBeTruthy();
  expect(screen.getByText("Session complete")).toBeTruthy();
  expect(screen.getByText("Good work. Every Review makes the next one easier.")).toBeTruthy();
  for (const name of ["Back", "Done"]) {
    const icon = screen.getByRole("button", { name }).querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  }
  await waitFor(async () =>
    expect((await loadReviews()).map((review) => review.right).sort()).toEqual([
      false,
      true,
      true,
      true,
    ]),
  );
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(startButton()).toBeTruthy();
  await expectListed(qa("a", 1));
});

it("the progress shows position and total, and the total grows when a Card answered wrong comes back", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));

  startSession();
  expect(await screen.findByText("1 / 2")).toBeTruthy();
  const bar = document.querySelector<HTMLElement>(".progress-track > span");
  expect(bar?.style.width).toBe("50%");
  // The text is the accessible progress; the bar is decoration.
  expect(bar?.parentElement?.getAttribute("aria-hidden")).toBe("true");
  await answer(false);
  expect(await screen.findByText("2 / 3")).toBeTruthy();
  await answer();
  expect(await screen.findByText("3 / 3")).toBeTruthy();
  await answer();

  await screen.findByRole("button", { name: "Done" });
  expect(screen.getByText("3 / 3")).toBeTruthy();
  expect(document.querySelector<HTMLElement>(".progress-track > span")?.style.width).toBe("100%");
});

it("a Card answered wrong comes back once, at the end", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));
  const asked = async () => (await screen.findByText(/^What is [ab]\?$/)).textContent;

  startSession();
  const first = await asked();
  await answer(false);
  expect(await asked()).not.toBe(first);
  await answer(true);
  expect(await asked()).toBe(first);
  await answer(false);

  await screen.findByText("3 answered, 1 right");
});

it("shows an error when a Review can't be stored, and the Session goes on", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));
  startSession();
  await screen.findByRole("button", { name: "Reveal" });
  blockStorage();

  await answer();

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  await answer();
  await screen.findByText(/2 answered, 2 right/);
});

it("shows an error when a Review of an option click can't be stored, and the Card goes on", async () => {
  render(<App />);
  await uploaded(multipleChoice("mc", 1));
  startSession();
  const option = await screen.findByRole("button", { name: "This" });
  blockStorage();

  fireEvent.click(option);

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(screen.getByText("Right.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText(/1 answered, 1 right/);
});

it("forgets a picked tag once no Card has it", async () => {
  render(<App />);
  const regression = tagged(qa("reg", 1), ["Statistics"], ["Regression"]);
  await uploaded(regression, qa("ml.trees.depth", 1));
  fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "Regression" } });

  openCards();
  deleteFromRow("reg");
  await expectNotListed(regression);
  goHome();

  expect(screen.getByLabelText<HTMLSelectElement>("Tag").value).toBe("");
  startSession();
  await answer();
  await screen.findByText(/1 answered, 1 right/);
});

/** Opens the Cards page, then this Card's preview, and presses the button with this name there. */
function fromPreview(id: string, name: string) {
  openCards();
  fireEvent.click(openPreview(id).getByRole("button", { name }));
}

/** Whether this Card's preview on the Cards page has Add to current Session disabled; closes the preview again. */
function addDisabled(id: string) {
  openCards();
  const preview = openPreview(id);
  const add = preview.getByRole<HTMLButtonElement>("button", { name: "Add to current Session" });
  const disabled = add.disabled;
  fireEvent.click(preview.getByRole("button", { name: "Close" }));
  return disabled;
}

/** Uploads Card a, with a tag only it has, and these Cards. */
async function uploadedWithA(...others: TCard[]) {
  render(<App />);
  await uploaded(tagged(qa("a", 1), ["Statistics"], ["Regression"]), ...others);
}

/** On Home, starts a Session of only Card a, picked by its tag. */
async function startSessionOfA() {
  goHome();
  fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "Regression" } });
  startSession();
  await screen.findByText("What is a?");
}

describe("Add to current Session and New Session", () => {
  it("Add to current Session is disabled with no Session; added to a running Session, the Card closes the preview, shows its notice, counts in the progress and records its Review", async () => {
    await uploadedWithA(qa("b", 2));
    expect(addDisabled("b")).toBe(true);
    await startSessionOfA();

    fromPreview("b", "Add to current Session");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect((await screen.findByRole("status")).textContent).toBe("Added to the current Session.");
    expect(isCurrent("Cards")).toBe(true);
    goTo("Session");
    expect(screen.getByText("1 / 2")).toBeTruthy();
    await answer();
    await screen.findByText("What is b?");
    expect(screen.getByText("2 / 2")).toBeTruthy();
    await answer();
    await screen.findByText("2 answered, 2 right");
    await waitFor(async () =>
      expect((await loadReviews()).map((each) => [each.cardId, each.cardVersion])).toEqual([
        ["a", 1],
        ["b", 2],
      ]),
    );
  });

  it("New Session replaces the running Session with one of only this Card, so only its Add is disabled, and records its Review", async () => {
    render(<App />);
    await uploaded(qa("a", 1), qa("b", 3));
    startSession();
    await answer();
    await screen.findByText("2 / 2");

    fromPreview("b", "New Session");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect((await screen.findByRole("status")).textContent).toBe(
      "New Session created with this Card.",
    );
    expect(isCurrent("Cards")).toBe(true);
    expect(addDisabled("b")).toBe(true);
    expect(addDisabled("a")).toBe(false);
    goTo("Session");
    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(screen.getByText("What is b?")).toBeTruthy();
    await answer();
    await screen.findByText("1 answered, 1 right");
    await waitFor(async () => {
      const log = await loadReviews();
      expect(log).toHaveLength(2);
      expect([log[1].cardId, log[1].cardVersion]).toEqual(["b", 3]);
    });
  });

  it("Add on the summary asks the added Card; after Done Add is disabled", async () => {
    await uploadedWithA(qa("b", 1), qa("c", 1));
    await startSessionOfA();
    await answer();
    await screen.findByRole("button", { name: "Done" });

    fromPreview("b", "Add to current Session");
    goTo("Session");

    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.getByText("What is b?")).toBeTruthy();
    await answer();
    await screen.findByText("2 answered, 2 right");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(addDisabled("c")).toBe(true);
  });

  it("Add to current Session is disabled for a Card already in the running Session, picked or added", async () => {
    await uploadedWithA(qa("b", 1), qa("c", 1));
    await startSessionOfA();

    expect(addDisabled("a")).toBe(true);
    expect(addDisabled("c")).toBe(false);
    fromPreview("b", "Add to current Session");
    await screen.findByRole("status");

    expect(addDisabled("b")).toBe(true);
    expect(addDisabled("c")).toBe(false);
  });

  it("a Card answered wrong comes back once, also when a Card is added after it", async () => {
    render(<App />);
    await uploaded(qa("a", 1), qa("b", 1));
    const asked = async () => (await screen.findByText(/^What is [ab]\?$/)).textContent;
    fromPreview("a", "New Session");
    goTo("Session");

    expect(await asked()).toBe("What is a?");
    await answer(false);
    fromPreview("b", "Add to current Session");
    goTo("Session");
    expect(screen.getByText("2 / 3")).toBeTruthy();
    expect(await asked()).toBe("What is a?");
    await answer(false);
    expect(await asked()).toBe("What is b?");
    await answer(false);
    expect(await asked()).toBe("What is b?");
    await answer();

    await screen.findByText("4 answered, 1 right");
  });
});
