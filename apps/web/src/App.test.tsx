import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { expect, it, vi } from "vitest";
import { App } from "./App";
import { addReview, loadReviews } from "./storage";
import {
  cloze,
  formula,
  multipleChoice,
  numeric,
  qa,
  review,
  tagged,
  trueFalse,
} from "./test/cards.fixtures";

function upload(...cards: TCard[]) {
  pick(
    new File([JSON.stringify({ cards })], "deck.json", { type: "application/json" }),
    "Upload Deck",
  );
}

function pick(file: File, label: string) {
  const input = screen.getByLabelText<HTMLInputElement>(label);
  // jsdom can't pick a file, so act like a browser: the value names the file until set to "".
  let files = [file];
  Object.defineProperty(input, "files", { configurable: true, get: () => files });
  Object.defineProperty(input, "value", {
    configurable: true,
    get: () => (files.length ? `C:\\fakepath\\${files[0].name}` : ""),
    set: (value: string) => {
      if (value === "") files = [];
    },
  });
  fireEvent.change(input);
}

// The test setup gives each test a fresh IndexedDB, so this lasts one test.
function blockStorage() {
  globalThis.indexedDB = {
    open() {
      throw new DOMException("Storage is blocked.", "SecurityError");
    },
  } as unknown as IDBFactory;
}

async function expectListed(card: TCard) {
  await screen.findByText(`${card.id} (${card.type}, version ${card.version})`);
}

it("renders the start page with the app name", () => {
  render(<App />);

  const heading = screen.getByRole("heading", { name: "Flashcards" });

  expect(heading.textContent).toBe("Flashcards");
});

it("shows the counts and lists the Cards after an upload", async () => {
  render(<App />);

  upload(qa("ml.trees.leaf-mean", 2), qa("ml.trees.depth", 1));

  await screen.findByText(/2 added, 0 updated, 0 unchanged/);
  await expectListed(qa("ml.trees.leaf-mean", 2));
  await expectListed(qa("ml.trees.depth", 1));
});

it("shows the errors of an invalid file", async () => {
  render(<App />);

  upload(qa("ml.trees.leaf-mean", 1, ""));

  await screen.findByText(/File rejected/);
  expect(screen.getByText(/ml\.trees\.leaf-mean: en\.answer: /)).toBeTruthy();
});

it("lists the stored Cards after a reload", async () => {
  const { unmount } = render(<App />);
  upload(qa("ml.trees.leaf-mean", 3));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);
  unmount();

  render(<App />);

  await expectListed(qa("ml.trees.leaf-mean", 3));
});

it("asks the browser to keep its storage", async () => {
  const persist = vi.fn(() => Promise.resolve(true));
  Object.defineProperty(navigator, "storage", { value: { persist }, configurable: true });
  try {
    render(<App />);

    await waitFor(() => expect(persist).toHaveBeenCalled());
  } finally {
    Reflect.deleteProperty(navigator, "storage");
  }
});

it("clears the file input after an upload, so the same file can be picked again", async () => {
  render(<App />);

  upload(qa("ml.trees.leaf-mean", 1));

  await screen.findByText(/1 added, 0 updated, 0 unchanged/);
  expect(screen.getByLabelText<HTMLInputElement>("Upload Deck").value).toBe("");
});

it("shows an error when the browser storage fails", async () => {
  blockStorage();

  render(<App />);

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
});

it("shows an error when the file can't be read", async () => {
  const file = new File([], "deck.json");
  file.text = () => Promise.reject(new DOMException("The file is gone.", "NotReadableError"));
  render(<App />);

  pick(file, "Upload Deck");

  expect((await screen.findByRole("alert")).textContent).toContain("The file is gone.");
});

it("hides the report of the last upload when the next one fails", async () => {
  render(<App />);
  upload(qa("ml.trees.leaf-mean", 1));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);

  const file = new File([], "deck.json");
  file.text = () => Promise.reject(new DOMException("The file is gone.", "NotReadableError"));
  pick(file, "Upload Deck");

  await screen.findByRole("alert");
  expect(screen.queryByText(/1 added, 0 updated, 0 unchanged/)).toBeNull();
});

it("keeps the error of a failed upload when an earlier upload finishes later", async () => {
  render(<App />);
  const deck = JSON.stringify({ cards: [qa("ml.trees.leaf-mean", 1)] });
  const slow = new File([deck], "deck.json", { type: "application/json" });
  // Hold the first file open, so the second upload fails before the first one finishes.
  let finishReading = () => {};
  slow.text = () =>
    new Promise((resolve) => {
      finishReading = () => resolve(deck);
    });
  pick(slow, "Upload Deck");
  const failing = new File([], "deck.json");
  failing.text = () => Promise.reject(new DOMException("The file is gone.", "NotReadableError"));
  pick(failing, "Upload Deck");
  await screen.findByRole("alert");

  finishReading();

  await expectListed(qa("ml.trees.leaf-mean", 1));
  expect(screen.getByRole("alert").textContent).toContain("The file is gone.");
  expect(screen.queryByText(/1 added, 0 updated, 0 unchanged/)).toBeNull();
});

async function expectNotListed(card: TCard) {
  await waitFor(() =>
    expect(screen.queryByText(`${card.id} (${card.type}, version ${card.version})`)).toBeNull(),
  );
}

it("deletes one Card, and it stays gone after a reload", async () => {
  const { unmount } = render(<App />);
  upload(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
  await expectListed(qa("ml.trees.leaf-mean", 1));

  fireEvent.click(screen.getByRole("button", { name: "Delete ml.trees.leaf-mean" }));

  await expectNotListed(qa("ml.trees.leaf-mean", 1));
  unmount();
  render(<App />);
  await expectListed(qa("ml.trees.depth", 1));
  expect(screen.queryByText(/ml\.trees\.leaf-mean/)).toBeNull();
});

it("keeps the Cards when clearing all is cancelled", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  try {
    const { unmount } = render(<App />);
    upload(qa("ml.trees.leaf-mean", 1));
    await expectListed(qa("ml.trees.leaf-mean", 1));

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(confirm).toHaveBeenCalledWith("Delete all Cards?");
    unmount();
    render(<App />);
    await expectListed(qa("ml.trees.leaf-mean", 1));
  } finally {
    confirm.mockRestore();
  }
});

it("clears all Cards after confirming, and they stay gone after a reload", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  try {
    const { unmount } = render(<App />);
    upload(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
    await expectListed(qa("ml.trees.depth", 1));

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(confirm).toHaveBeenCalledWith("Delete all Cards?");
    await expectNotListed(qa("ml.trees.leaf-mean", 1));
    await expectNotListed(qa("ml.trees.depth", 1));
    unmount();
    render(<App />);
    // An empty list proves nothing before the reload finishes; "1 added" shows storage was empty.
    upload(qa("ml.trees.leaf-mean", 1));
    await screen.findByText(/1 added, 0 updated, 0 unchanged/);
    await expectListed(qa("ml.trees.leaf-mean", 1));
    expect(screen.queryByText(/ml\.trees\.depth/)).toBeNull();
  } finally {
    confirm.mockRestore();
  }
});

it("shows Clear all only while Cards are stored", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  try {
    render(<App />);
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();

    upload(qa("ml.trees.leaf-mean", 1));
    fireEvent.click(await screen.findByRole("button", { name: "Clear all" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull());
  } finally {
    confirm.mockRestore();
  }
});

it("keeps the report of the last upload after deleting a Card", async () => {
  render(<App />);
  upload(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
  await expectListed(qa("ml.trees.leaf-mean", 1));

  fireEvent.click(screen.getByRole("button", { name: "Delete ml.trees.leaf-mean" }));

  await expectNotListed(qa("ml.trees.leaf-mean", 1));
  expect(screen.getByText(/2 added, 0 updated, 0 unchanged/)).toBeTruthy();
});

it("shows an error and keeps the Card when deleting fails", async () => {
  render(<App />);
  upload(qa("ml.trees.leaf-mean", 1));
  await expectListed(qa("ml.trees.leaf-mean", 1));
  blockStorage();

  fireEvent.click(screen.getByRole("button", { name: "Delete ml.trees.leaf-mean" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  await expectListed(qa("ml.trees.leaf-mean", 1));
});

async function uploaded(...cards: TCard[]) {
  upload(...cards);
  await expectListed(cards[cards.length - 1]);
}

function startButton() {
  return screen.getByRole<HTMLButtonElement>("button", { name: "Start Session" });
}

function startSession() {
  fireEvent.click(startButton());
}

async function answer(knew = true) {
  fireEvent.click(await screen.findByRole("button", { name: "Reveal" }));
  fireEvent.click(screen.getByRole("button", { name: knew ? "Knew it" : "Didn't know" }));
}

it("starts a Session with 20 Cards by default, or the number set", async () => {
  render(<App />);
  await uploaded(...Array.from({ length: 25 }, (_, i) => qa(`card-${i + 1}`, 1)));
  expect(screen.getByLabelText<HTMLInputElement>("Cards").value).toBe("20");

  startSession();
  for (let i = 0; i < 20; i++) await answer();
  await screen.findByText(/20 answered, 20 right/);

  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.change(screen.getByLabelText("Cards"), { target: { value: "3" } });
  startSession();
  for (let i = 0; i < 3; i++) await answer();
  await screen.findByText(/3 answered, 3 right/);
});

it("starts a Session with only the Cards of the picked tag", async () => {
  render(<App />);
  await uploaded(
    tagged(qa("reg-1", 1), ["Statistics"], ["Regression"]),
    tagged(qa("reg-2", 1), ["Regression"], ["Bias"]),
    tagged(qa("other", 1), ["Statistics"], ["Bias"]),
  );
  const tag = screen.getByLabelText<HTMLSelectElement>("Tag");
  expect(Array.from(tag.options, (option) => option.text)).toEqual([
    "Any tag",
    "Bias",
    "Regression",
    "Statistics",
  ]);

  fireEvent.change(tag, { target: { value: "Regression" } });
  startSession();
  await answer();
  await answer();

  await screen.findByText(/2 answered, 2 right/);
});

it("a Session asks Cards never reviewed first, then those answered wrong", async () => {
  await addReview({
    cardId: "known",
    cardVersion: 1,
    answeredAt: "2026-11-15T10:00:00.000Z",
    right: true,
    durationMs: 3000,
  });
  await addReview({
    cardId: "missed",
    cardVersion: 1,
    answeredAt: "2026-11-15T10:01:00.000Z",
    right: false,
    durationMs: 3000,
  });
  render(<App />);
  await uploaded(qa("known", 1), qa("missed", 1), qa("unseen", 1));
  fireEvent.change(screen.getByLabelText("Cards"), { target: { value: "2" } });

  startSession();
  await screen.findByText("What is unseen?");
  await answer();
  await screen.findByText("What is missed?");
  await answer();

  await screen.findByText("2 answered, 2 right");
});

it("shows an error and starts no Session when the Review log can't be loaded", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  blockStorage();

  startSession();

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(startButton()).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Reveal" })).toBeNull();
});

it("disables Start Session with no Cards or with fewer than 1 Card", async () => {
  render(<App />);
  expect(startButton().disabled).toBe(true);

  await uploaded(qa("ml.trees.depth", 1));
  expect(startButton().disabled).toBe(false);

  fireEvent.change(screen.getByLabelText("Cards"), { target: { value: "0" } });
  expect(startButton().disabled).toBe(true);

  fireEvent.change(screen.getByLabelText("Cards"), { target: { value: "" } });
  expect(startButton().disabled).toBe(true);
});

it("hides the upload and the Card list during a Session", async () => {
  render(<App />);
  await uploaded(qa("ml.trees.depth", 1));

  startSession();

  await screen.findByRole("button", { name: "Reveal" });
  expect(screen.getByRole("heading", { name: "Flashcards" })).toBeTruthy();
  expect(screen.queryByLabelText("Upload Deck")).toBeNull();
  expect(screen.queryByText(/ml\.trees\.depth \(qa/)).toBeNull();
});

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

it.each([
  {
    case: "formula with an example, Knew it",
    card: formula("norm", 1, "norm of 2 and 3 is 6."),
    prompt: ["The norm formula", "norm is a times b."],
    answer: ["norm = a · b", "norm of 2 and 3 is 6."],
    knew: true,
  },
  {
    case: "formula without an example, Didn't know",
    card: formula("norm", 1),
    prompt: ["The norm formula", "norm is a times b."],
    answer: ["norm = a · b"],
    knew: false,
  },
  {
    case: "cloze with two gaps, Didn't know",
    card: cloze("depth", 1, "A {{deep}} tree has {{high}} variance."),
    prompt: ["A ____ tree has ____ variance."],
    answer: ["A deep tree has high variance."],
    knew: false,
  },
])("shows the prompt, Reveal shows the answer, and grading appends a Review ($case)", async (c) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    render(<App />);
    await uploaded(c.card);
    vi.setSystemTime(new Date("2026-11-15T10:00:00.000Z"));

    startSession();
    for (const line of c.prompt) await screen.findByText(line);
    for (const line of c.answer) expect(screen.queryByText(line)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    for (const line of c.answer) expect(screen.getByText(line)).toBeTruthy();
    vi.setSystemTime(new Date("2026-11-15T10:00:05.000Z"));
    fireEvent.click(screen.getByRole("button", { name: c.knew ? "Knew it" : "Didn't know" }));

    await waitFor(async () =>
      expect(await loadReviews()).toEqual([
        {
          cardId: c.card.id,
          cardVersion: 1,
          answeredAt: "2026-11-15T10:00:05.000Z",
          right: c.knew,
          durationMs: 5000,
        },
      ]),
    );
    // A wrong Card comes back, so only a right one ends this one-Card Session.
    if (c.knew) await screen.findByText("1 answered, 1 right");
  } finally {
    vi.useRealTimers();
  }
});

const choices = ["This", "That"];
const trueOrFalse = ["True", "False"];

it.each([
  {
    case: "multiple_choice, right",
    card: multipleChoice("mc", 1),
    prompt: "Which is mc?",
    options: choices,
    click: "This",
    right: true,
    shown: "This",
    explanation: "This one.",
  },
  {
    case: "multiple_choice, wrong",
    card: multipleChoice("mc", 1),
    prompt: "Which is mc?",
    options: choices,
    click: "That",
    right: false,
    shown: "This",
    explanation: "This one.",
  },
  {
    case: "true_false, true",
    card: trueFalse("tf", 1, true),
    prompt: "tf is true.",
    options: trueOrFalse,
    click: "True",
    right: true,
    shown: "True",
  },
  {
    case: "true_false, false",
    card: trueFalse("tf", 1, false),
    prompt: "tf is true.",
    options: trueOrFalse,
    click: "True",
    right: false,
    shown: "False",
  },
])("shows right or wrong after a click on an option ($case)", async (c) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    render(<App />);
    await uploaded(c.card);
    vi.setSystemTime(new Date("2026-11-15T10:00:00.000Z"));

    startSession();
    await screen.findByText(c.prompt);
    expect(screen.queryByText(`Answer: ${c.shown}`)).toBeNull();
    if (c.explanation) expect(screen.queryByText(c.explanation)).toBeNull();
    vi.setSystemTime(new Date("2026-11-15T10:00:03.000Z"));
    fireEvent.click(screen.getByRole("button", { name: c.click }));

    expect(screen.getByText(c.right ? "Right." : "Wrong.")).toBeTruthy();
    expect(screen.getByText(`Answer: ${c.shown}`)).toBeTruthy();
    if (c.explanation) expect(screen.getByText(c.explanation)).toBeTruthy();
    for (const option of c.options) {
      expect(screen.getByRole<HTMLButtonElement>("button", { name: option }).disabled).toBe(true);
    }
    await waitFor(async () =>
      expect(await loadReviews()).toEqual([
        {
          cardId: c.card.id,
          cardVersion: 1,
          answeredAt: "2026-11-15T10:00:03.000Z",
          right: c.right,
          durationMs: 3000,
        },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // A wrong Card comes back, so only a right one ends this one-Card Session.
    if (c.right) await screen.findByText("1 answered, 1 right");
  } finally {
    vi.useRealTimers();
  }
});

it.each([
  {
    case: "5.01 with a unit, Check, right",
    card: numeric("mean", 1, "cm"),
    typed: "5.01",
    enter: false,
    right: true,
    shown: "5 cm",
  },
  {
    case: "5.02 without a unit, Enter, wrong",
    card: numeric("mean", 1),
    typed: "5.02",
    enter: true,
    right: false,
    shown: "5",
  },
])("checks a typed number within the allowed error ($case)", async (c) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    render(<App />);
    await uploaded(c.card);
    vi.setSystemTime(new Date("2026-11-15T10:00:00.000Z"));

    startSession();
    await screen.findByText("How much is mean?");
    if (c.card.unit) expect(screen.getByText(c.card.unit)).toBeTruthy();
    const input = screen.getByLabelText<HTMLInputElement>("Answer");
    const check = screen.getByRole<HTMLButtonElement>("button", { name: "Check" });
    expect(check.disabled).toBe(true);
    fireEvent.change(input, { target: { value: c.typed } });
    expect(check.disabled).toBe(false);
    expect(screen.queryByText(`Answer: ${c.shown}`)).toBeNull();
    vi.setSystemTime(new Date("2026-11-15T10:00:07.000Z"));
    // Enter in an input submits its form.
    if (c.enter) fireEvent.submit(input.form!);
    else fireEvent.click(check);

    expect(screen.getByText(c.right ? "Right." : "Wrong.")).toBeTruthy();
    expect(screen.getByText(`Answer: ${c.shown}`)).toBeTruthy();
    expect(input.disabled).toBe(true);
    expect(check.disabled).toBe(true);
    await waitFor(async () =>
      expect(await loadReviews()).toEqual([
        {
          cardId: "mean",
          cardVersion: 1,
          answeredAt: "2026-11-15T10:00:07.000Z",
          right: c.right,
          durationMs: 7000,
        },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // A wrong Card comes back, so only a right one ends this one-Card Session.
    if (c.right) await screen.findByText("1 answered, 1 right");
  } finally {
    vi.useRealTimers();
  }
});

it("Enter with an empty input or after Check answers nothing", async () => {
  render(<App />);
  await uploaded(numeric("mean", 1));
  startSession();
  const input = await screen.findByLabelText<HTMLInputElement>("Answer");

  fireEvent.submit(input.form!);
  expect(screen.queryByText(/^(Right|Wrong)\.$/)).toBeNull();
  expect(input.disabled).toBe(false);

  fireEvent.change(input, { target: { value: "5" } });
  fireEvent.submit(input.form!);
  fireEvent.submit(input.form!);

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("1 answered, 1 right");
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

  fireEvent.click(screen.getByRole("button", { name: "Delete reg" }));
  await expectNotListed(regression);

  expect(screen.getByLabelText<HTMLSelectElement>("Tag").value).toBe("");
  startSession();
  await answer();
  await screen.findByText(/1 answered, 1 right/);
});

/** The text of each cell of the table with this name, row by row, header row first. */
function rows(name: string) {
  return within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map((row) => Array.from(row.querySelectorAll("th, td"), (cell) => cell.textContent));
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

  fireEvent.click(screen.getByRole("button", { name: "Statistics" }));

  await screen.findByRole("table", { name: "Cards" });
  expect(screen.queryByLabelText("Upload Deck")).toBeNull();
  const lastReviewed = new Date("2026-11-15T10:00:00.000Z").toLocaleDateString();
  expect(rows("Cards")).toEqual([
    ["Card", "Reviews", "Share right", "Last reviewed"],
    ["a", "3", "67%", lastReviewed],
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

it("shows an error when the Review log can't be loaded", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  blockStorage();

  fireEvent.click(screen.getByRole("button", { name: "Statistics" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(startButton()).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});

/** Clicks the button and returns the file it downloads. jsdom can't download, so this fakes the browser's part. */
async function download(button: string): Promise<File> {
  const blobs = new Map<string, Blob>();
  const create = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = `blob:download-${blobs.size}`;
    blobs.set(url, blob as Blob);
    return url;
  });
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    fireEvent.click(screen.getByRole("button", { name: button }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    const url = link.getAttribute("href")!;
    await waitFor(() => expect(revoke).toHaveBeenCalledWith(url));
    return new File([blobs.get(url)!], link.download, { type: "application/json" });
  } finally {
    click.mockRestore();
    create.mockRestore();
    revoke.mockRestore();
  }
}

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
  expect(screen.getByText("No download yet")).toBeTruthy();

  await download("Download Cards");
  expect(screen.getByText("No download yet")).toBeTruthy();

  await download("Download Review log");
  await screen.findByText("Days since the last download: 0");
  expect(screen.queryByText("No download yet")).toBeNull();
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
    await screen.findByText("Days since the last download: 2");
    second.unmount();

    vi.setSystemTime(new Date("2026-11-15T10:00:00.000Z"));
    render(<App />);
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
