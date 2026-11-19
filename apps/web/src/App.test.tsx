import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { expect, it, vi } from "vitest";
import { Alert, type TAlertTone } from "./Alert";
import { App } from "./App";
import { addReview, loadLanguage, loadReviews } from "./storage";
import {
  cloze,
  formula,
  german,
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

function levelOneHeadings() {
  return screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent);
}

it("Home's heading welcomes back, with Flashcards as its only level-1 heading", () => {
  render(<App />);

  expect(levelOneHeadings()).toEqual(["Flashcards"]);
  expect(screen.getByText("Welcome back")).toBeTruthy();
  expect(screen.getByText("A calm routine for durable learning.")).toBeTruthy();
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

it("shows the report of a rejected file without interrupting, so only errors are alerts", async () => {
  render(<App />);

  upload(qa("ml.trees.leaf-mean", 1, ""));

  await screen.findByText(/File rejected/);
  expect(screen.queryByRole("alert")).toBeNull();
});

// The markup of the icon an Alert of this tone shows.
function alertIcon(tone: TAlertTone): string {
  const { container, unmount } = render(<Alert tone={tone}>Message</Alert>);
  const icon = container.querySelector("svg")!.outerHTML;
  unmount();
  return icon;
}

function shownIcons(): string[] {
  return [...document.querySelectorAll("svg")].map((icon) => icon.outerHTML);
}

it("shows the success icon with an accepted upload and the danger icon with a rejected one", async () => {
  const success = alertIcon("success");
  const danger = alertIcon("danger");
  render(<App />);

  upload(qa("ml.trees.leaf-mean", 1));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);
  expect(shownIcons()).toContain(success);
  expect(shownIcons()).not.toContain(danger);

  upload(qa("ml.trees.depth", 1, ""));
  await screen.findByText(/File rejected/);
  expect(shownIcons()).toContain(danger);
  expect(shownIcons()).not.toContain(success);
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

function deleteAllButton() {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: /^(Delete all Cards|Alle Karten löschen)$/,
  });
}

/** Opens the Delete all Cards modal and returns queries inside it. */
function openDeleteAll() {
  fireEvent.click(deleteAllButton());
  return within(screen.getByRole("dialog"));
}

async function expectNoDialog() {
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

it("asks before deleting all Cards, saying how many and that it cannot be undone", async () => {
  const danger = alertIcon("danger");
  render(<App />);
  await uploaded(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
  expect(deleteAllButton().querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

  const modal = openDeleteAll();

  expect(screen.getByRole("dialog", { name: "Delete all Cards?" })).toBeTruthy();
  expect(modal.getByText("This cannot be undone.")).toBeTruthy();
  expect(
    modal.getByText("All 2 Cards will be permanently removed from this browser."),
  ).toBeTruthy();
  expect(modal.getByRole("button", { name: "Cancel" })).toBeTruthy();
  expect(modal.getByRole("button", { name: "Delete all Cards" })).toBeTruthy();
  expect(modal.getByRole("button", { name: "Close" })).toBeTruthy();
  const icons = [...screen.getByRole("dialog").querySelectorAll("svg")].map(
    (icon) => icon.outerHTML,
  );
  expect(icons).toContain(danger);
});

it("says 1 Card in the singular", async () => {
  render(<App />);
  await uploaded(qa("ml.trees.leaf-mean", 1));

  const modal = openDeleteAll();

  expect(modal.getByText("1 Card will be permanently removed from this browser.")).toBeTruthy();
});

it.each<[string, () => void]>([
  [
    "Cancel",
    () =>
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })),
  ],
  [
    "Close",
    () =>
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" })),
  ],
  ["Escape", () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })],
  // The backdrop is the dialog's parent; it has no role to query by.
  [
    "a mouse-down on the backdrop",
    () => fireEvent.mouseDown(screen.getByRole("dialog").parentElement!),
  ],
])("%s closes the modal and keeps the Cards, also after a reload", async (_, dismiss) => {
  const { unmount } = render(<App />);
  await uploaded(qa("ml.trees.leaf-mean", 1));
  openDeleteAll();

  dismiss();

  await expectNoDialog();
  await expectListed(qa("ml.trees.leaf-mean", 1));
  unmount();
  render(<App />);
  await expectListed(qa("ml.trees.leaf-mean", 1));
});

it("deletes all Cards from the modal, and they stay gone after a reload", async () => {
  const { unmount } = render(<App />);
  await uploaded(qa("ml.trees.leaf-mean", 1), qa("ml.trees.depth", 1));
  expect(screen.queryByRole("heading", { name: "No Cards yet" })).toBeNull();

  fireEvent.click(openDeleteAll().getByRole("button", { name: "Delete all Cards" }));

  await expectNoDialog();
  await expectNotListed(qa("ml.trees.leaf-mean", 1));
  await expectNotListed(qa("ml.trees.depth", 1));
  expect(screen.getByRole("heading", { level: 3, name: "No Cards yet" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Start a Session" })).toBeNull();
  unmount();
  render(<App />);
  // An empty list proves nothing before the reload finishes; "1 added" shows storage was empty.
  upload(qa("ml.trees.leaf-mean", 1));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);
  await expectListed(qa("ml.trees.leaf-mean", 1));
  expect(screen.queryByText(/ml\.trees\.depth/)).toBeNull();
});

it("closes the modal before deleting, so a failure shows in the page's error and the Cards stay", async () => {
  render(<App />);
  await uploaded(qa("ml.trees.leaf-mean", 1));
  const modal = openDeleteAll();
  blockStorage();

  fireEvent.click(modal.getByRole("button", { name: "Delete all Cards" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(screen.queryByRole("dialog")).toBeNull();
  await expectListed(qa("ml.trees.leaf-mean", 1));
});

it("disables Delete all Cards while no Cards are stored", async () => {
  render(<App />);
  expect(deleteAllButton().disabled).toBe(true);

  await uploaded(qa("ml.trees.leaf-mean", 1));
  expect(deleteAllButton().disabled).toBe(false);

  fireEvent.click(openDeleteAll().getByRole("button", { name: "Delete all Cards" }));

  await waitFor(() => expect(deleteAllButton().disabled).toBe(true));
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
  return screen.getByRole<HTMLButtonElement>("button", {
    name: /^(Start Session|Sitzung starten)$/,
  });
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

it("shows no Start Session with no Cards, and disables it with fewer than 1 Card", async () => {
  render(<App />);
  expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();

  await uploaded(qa("ml.trees.depth", 1));
  expect(startButton().disabled).toBe(false);

  fireEvent.change(screen.getByLabelText("Cards"), { target: { value: "0" } });
  expect(startButton().disabled).toBe(true);

  fireEvent.change(screen.getByLabelText("Cards"), { target: { value: "" } });
  expect(startButton().disabled).toBe(true);
});

it("with Cards, Home shows the Start a Session panel and no empty state", async () => {
  render(<App />);
  await uploaded(qa("a", 1));

  expect(home().getByRole("heading", { level: 2, name: "Start a Session" })).toBeTruthy();
  expect(home().getByText("Study today")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "No Cards yet" })).toBeNull();
});

it("the Card count on Home reads 2 Cards and opens the Cards page", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));

  const library = home().getByRole("button", { name: /^2 Cards/ });
  expect(library.textContent).toContain("Manage library and backups");
  fireEvent.click(library);

  expect(isCurrent("Cards")).toBe(true);
  expect(screen.getByText("This page is not built yet.")).toBeTruthy();
});

it("the Card count on Home reads 1 Card for one Card", async () => {
  render(<App />);
  await uploaded(qa("a", 1));

  expect(home().getByRole("button", { name: /^1 Card(?!s)/ })).toBeTruthy();
});

it("the Card count follows a deleted Card, and deleting the last one shows the empty state", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));

  fireEvent.click(screen.getByRole("button", { name: "Delete a" }));
  await expectNotListed(qa("a", 1));
  expect(home().getByRole("button", { name: /^1 Card(?!s)/ })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Delete b" }));
  await expectNotListed(qa("b", 1));
  expect(home().getByRole("heading", { level: 3, name: "No Cards yet" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Start a Session" })).toBeNull();
});

it("with no Cards, Home shows the empty state and no Start a Session panel", () => {
  render(<App />);

  expect(home().getByRole("heading", { level: 3, name: "No Cards yet" })).toBeTruthy();
  expect(home().getByText("Upload a Deck to start your first Session.")).toBeTruthy();
  expect(home().getByRole("button", { name: "Upload Deck" })).toBeTruthy();
  expect(home().getByRole("button", { name: "Create Card" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Start a Session" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();
});

// Until the Cards page has uploads and the Card editor exists, both buttons open the Cards page.
it.each(["Upload Deck", "Create Card"])("with no Cards, %s opens the Cards page", (name) => {
  render(<App />);

  fireEvent.click(home().getByRole("button", { name }));

  expect(isCurrent("Cards")).toBe(true);
  expect(screen.getByText("This page is not built yet.")).toBeTruthy();
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

// The navigation has a Statistics button too, so a click on Home's looks inside main only.
function home() {
  return within(screen.getByRole("main"));
}

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

  fireEvent.click(home().getByRole("button", { name: "Statistics" }));

  await screen.findByRole("table", { name: "Cards" });
  expect(screen.queryByLabelText("Upload Deck")).toBeNull();
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

it("shows an error when the Review log can't be loaded", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  blockStorage();

  fireEvent.click(home().getByRole("button", { name: "Statistics" }));

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

/** Runs the test with this browser language; jsdom's own is "en-US". */
async function withBrowserLanguage(language: string, test: () => Promise<void>) {
  Object.defineProperty(navigator, "language", { value: language, configurable: true });
  try {
    await test();
  } finally {
    Reflect.deleteProperty(navigator, "language");
  }
}

function languageSelect() {
  return screen.getByLabelText<HTMLSelectElement>(/^(Language|Sprache)$/);
}

it.each([
  ["de-DE", "de"],
  ["de", "de"],
  ["en-US", "en"],
  ["fr-FR", "en"],
  ["DE-AT", "de"],
])("with browser language %s, the language is %s until the Learner picks one", (browser, shown) =>
  withBrowserLanguage(browser, async () => {
    render(<App />);

    expect(Array.from(languageSelect().options, (option) => option.text)).toEqual([
      "English",
      "Deutsch",
    ]);
    expect(languageSelect().value).toBe(shown);
  }),
);

it("the picked language survives a reload and wins over the browser language", () =>
  withBrowserLanguage("de-DE", async () => {
    const { unmount } = render(<App />);

    fireEvent.change(languageSelect(), { target: { value: "en" } });

    await waitFor(async () => expect(await loadLanguage()).toBe("en"));
    unmount();
    render(<App />);
    await waitFor(() => expect(languageSelect().value).toBe("en"));
  }));

it.each([
  {
    case: "qa with only a German question",
    card: german(qa("q", 1, "An answer."), { question: "Was ist q?" }),
    language: "de",
    prompt: ["Was ist q?"],
    hidden: ["What is q?"],
    click: "Aufdecken",
    after: ["An answer."],
  },
  {
    case: "multiple_choice with German question and options, no German explanation",
    card: german(multipleChoice("mc", 1), {
      question: "Welches ist mc?",
      options: ["Dies", "Das"],
    }),
    language: "de",
    prompt: ["Welches ist mc?", "Dies", "Das"],
    hidden: ["Which is mc?", "This", "That"],
    click: "Dies",
    after: ["Antwort: Dies", "This one."],
  },
  {
    case: "cloze with German text",
    card: german(cloze("depth", 1, "A {{deep}} tree."), { text: "Ein {{tiefer}} Baum." }),
    language: "de",
    prompt: ["Ein ____ Baum."],
    hidden: ["A ____ tree."],
    click: "Aufdecken",
    after: ["Ein tiefer Baum."],
  },
  {
    case: "formula with only a German name",
    card: german(formula("norm", 1), { name: "Die norm-Formel" }),
    language: "de",
    prompt: ["Die norm-Formel", "norm is a times b."],
    hidden: ["The norm formula"],
    click: "Aufdecken",
    after: ["norm = a · b"],
  },
  {
    case: "true_false with a German statement, and Wahr and Falsch as options",
    card: german(trueFalse("tf", 1), { statement: "tf ist wahr." }),
    language: "de",
    prompt: ["tf ist wahr.", "Wahr", "Falsch"],
    hidden: ["tf is true.", "True", "False"],
    click: "Wahr",
    after: ["Antwort: Wahr"],
  },
  {
    case: "German Card, English picked",
    card: german(qa("q", 1, "An answer."), { question: "Was ist q?", answer: "Eine Antwort." }),
    language: "en",
    prompt: ["What is q?"],
    hidden: ["Was ist q?"],
    click: "Reveal",
    after: ["An answer."],
  },
])("shows the Card text in the picked language, field by field ($case)", async (c) => {
  render(<App />);
  await uploaded(c.card);
  fireEvent.change(languageSelect(), { target: { value: c.language } });

  startSession();

  for (const text of c.prompt) await screen.findByText(text);
  for (const text of c.hidden) expect(screen.queryByText(text)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: c.click }));
  for (const text of c.after) expect(screen.getByText(text)).toBeTruthy();
});

it("shows an error when the picked language can't be saved, and the language still changes", async () => {
  render(<App />);
  await uploaded(german(qa("q", 1), { question: "Was ist q?" }));
  blockStorage();

  fireEvent.change(languageSelect(), { target: { value: "de" } });

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(languageSelect().value).toBe("de");
  // Storage works again, so the Session can load the Review log.
  globalThis.indexedDB = new IDBFactory();
  startSession();
  await screen.findByText("Was ist q?");
});

it("clears the error once the picked language is saved", async () => {
  render(<App />);
  await uploaded(qa("q", 1));
  blockStorage();
  fireEvent.change(languageSelect(), { target: { value: "de" } });
  await screen.findByRole("alert");
  globalThis.indexedDB = new IDBFactory();

  fireEvent.change(languageSelect(), { target: { value: "en" } });

  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

function pickGerman() {
  fireEvent.change(languageSelect(), { target: { value: "de" } });
}

// languageSelect() and startButton() match both languages, so this pins the English names.
it("labels the language select Language and the start button Start Session in English", async () => {
  render(<App />);
  await uploaded(qa("a", 1));

  expect(screen.getByLabelText("Language")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Start Session" })).toBeTruthy();
});

it("shows the start page in German once Deutsch is picked", async () => {
  render(<App />);
  await uploaded(qa("a", 1));

  pickGerman();

  expect(screen.getByLabelText("Sprache")).toBeTruthy();
  expect(screen.getByLabelText("Karten")).toBeTruthy();
  const tag = screen.getByLabelText<HTMLSelectElement>("Tag");
  expect(tag.options[0].text).toBe("Alle Tags");
  for (const name of [
    "Sitzung starten",
    "Statistik",
    "Karten herunterladen",
    "Lernprotokoll herunterladen",
  ]) {
    expect(home().getByRole("button", { name })).toBeTruthy();
  }
  expect(screen.getByLabelText("Deck hochladen")).toBeTruthy();
  expect(screen.getByLabelText("Lernprotokoll hochladen")).toBeTruthy();
  expect(screen.getByText("Noch nichts heruntergeladen")).toBeTruthy();
});

it("shows Home's heading in German", () => {
  render(<App />);

  pickGerman();

  expect(levelOneHeadings()).toEqual(["Flashcards"]);
  expect(screen.getByText("Willkommen zurück")).toBeTruthy();
  expect(screen.getByText("Eine ruhige Routine für nachhaltiges Lernen.")).toBeTruthy();
});

it("shows the Start a Session panel and the Card count in German", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));

  pickGerman();

  expect(home().getByRole("heading", { level: 2, name: "Sitzung starten" })).toBeTruthy();
  expect(home().getByText("Heute lernen")).toBeTruthy();
  const library = home().getByRole("button", { name: /^2 Karten/ });
  expect(library.textContent).toContain("Bibliothek und Sicherungen verwalten");
});

it("the Card count reads 1 Karte for one Card in German", async () => {
  render(<App />);
  await uploaded(qa("a", 1));

  pickGerman();

  expect(home().getByRole("button", { name: /^1 Karte(?!n)/ })).toBeTruthy();
});

it("shows the empty state in German", () => {
  render(<App />);

  pickGerman();

  expect(home().getByRole("heading", { level: 3, name: "Noch keine Karten" })).toBeTruthy();
  expect(home().getByText("Lade ein Deck hoch, um deine erste Sitzung zu starten.")).toBeTruthy();
  expect(home().getByRole("button", { name: "Deck hochladen" })).toBeTruthy();
  expect(home().getByRole("button", { name: "Karte erstellen" })).toBeTruthy();
});

it("shows the days since the last download in German", async () => {
  render(<App />);
  pickGerman();

  await download("Lernprotokoll herunterladen");

  await screen.findByText("Tage seit dem letzten Herunterladen: 0");
});

it("shows a Deck upload in German: the counts, the Card list and its buttons", async () => {
  render(<App />);
  pickGerman();

  const deck = JSON.stringify({ cards: [qa("q", 1)] });
  pick(new File([deck], "deck.json", { type: "application/json" }), "Deck hochladen");

  await screen.findByText("1 hinzugefügt, 0 aktualisiert, 0 unverändert");
  expect(screen.getByText("q (qa, Version 1)")).toBeTruthy();
  expect(screen.getByRole("button", { name: "q löschen" }).textContent).toBe("Löschen");
  expect(screen.getByRole("button", { name: "Alle Karten löschen" })).toBeTruthy();
});

it("shows a Review log upload in German, and a rejected file keeps its details in English", async () => {
  render(<App />);
  pickGerman();
  const valid = JSON.stringify({ reviews: [review("a", 1, "2026-11-15T10:00:00.000Z")] });
  const invalid = JSON.stringify({ reviews: [review("a", 0, "2026-11-15T10:00:00.000Z")] });

  pick(
    new File([valid], "review-log.json", { type: "application/json" }),
    "Lernprotokoll hochladen",
  );
  await screen.findByText("1 hinzugefügt, 0 übersprungen");
  pick(
    new File([invalid], "review-log.json", { type: "application/json" }),
    "Lernprotokoll hochladen",
  );

  await screen.findByText("Datei abgelehnt");
  expect(screen.getByText(/review 1: cardVersion: /)).toBeTruthy();
});

it("asks in German before deleting all Cards", async () => {
  render(<App />);
  await uploaded(qa("q", 1));
  pickGerman();

  fireEvent.click(screen.getByRole("button", { name: "Alle Karten löschen" }));

  const modal = within(screen.getByRole("dialog", { name: "Alle Karten löschen?" }));
  expect(modal.getByText("Das kann nicht rückgängig gemacht werden.")).toBeTruthy();
  expect(modal.getByText("1 Karte wird endgültig aus diesem Browser entfernt.")).toBeTruthy();
  expect(modal.getByRole("button", { name: "Abbrechen" })).toBeTruthy();
  expect(modal.getByRole("button", { name: "Alle Karten löschen" })).toBeTruthy();
  expect(modal.getByRole("button", { name: "Schließen" })).toBeTruthy();
});

it("says how many Cards in German, in the plural", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));
  pickGerman();

  const modal = openDeleteAll();

  expect(
    modal.getByText("Alle 2 Karten werden endgültig aus diesem Browser entfernt."),
  ).toBeTruthy();
});

it.each([
  {
    case: "qa: Aufdecken, then Gewusst and Nicht gewusst",
    card: qa("q", 1),
    async answer() {
      fireEvent.click(await screen.findByRole("button", { name: "Aufdecken" }));
      expect(screen.getByRole("button", { name: "Nicht gewusst" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Gewusst" }));
    },
    summary: "1 beantwortet, 1 richtig",
  },
  {
    case: "true_false: Wahr and Falsch, then Falsch. and Antwort: Wahr after a wrong pick",
    card: trueFalse("tf", 1, true),
    async answer() {
      expect(await screen.findByRole("button", { name: "Wahr" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Falsch" }));
      expect(screen.getByText("Falsch.")).toBeTruthy();
      expect(screen.getByText("Antwort: Wahr")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
      // The Card answered wrong comes back.
      fireEvent.click(await screen.findByRole("button", { name: "Wahr" }));
      fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    },
    summary: "2 beantwortet, 1 richtig",
  },
  {
    case: "numeric: the input Antwort and Prüfen, then Richtig.",
    card: numeric("mean", 1),
    async answer() {
      fireEvent.change(await screen.findByLabelText("Antwort"), { target: { value: "5" } });
      fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
      expect(screen.getByText("Richtig.")).toBeTruthy();
      expect(screen.getByText("Antwort: 5")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    },
    summary: "1 beantwortet, 1 richtig",
  },
])("shows the Session in German ($case)", async (c) => {
  render(<App />);
  await uploaded(c.card);
  pickGerman();

  startSession();
  await c.answer();

  await screen.findByText(c.summary);
  fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
  expect(screen.getByRole("button", { name: "Sitzung starten" })).toBeTruthy();
});

it("shows Statistics in German, with German dates, and Zurück goes back", async () => {
  await addReview(review("a", 1, "2026-11-15T10:00:00.000Z"));
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));
  pickGerman();

  fireEvent.click(home().getByRole("button", { name: "Statistik" }));

  await screen.findByRole("table", { name: "Karten" });
  expect(rows("Karten")).toEqual([
    ["Karte", "Wiederholungen", "Anteil richtig", "Zuletzt wiederholt"],
    ["a", "1", "100%", "15.11.2026"],
    ["b", "0", "–", "nie"],
  ]);
  expect(rows("Fachgebiet-Tags")).toEqual([
    ["Tag", "Karten", "Wiederholungen", "Anteil richtig"],
    ["Machine Learning", "2", "1", "100%"],
  ]);
  expect(rows("Themen-Tags")).toEqual([
    ["Tag", "Karten", "Wiederholungen", "Anteil richtig"],
    ["Decision Tree", "2", "1", "100%"],
  ]);

  fireEvent.click(screen.getByRole("button", { name: "Zurück" }));

  expect(screen.getByRole("button", { name: "Sitzung starten" })).toBeTruthy();
});

it("with a German browser language and nothing picked, the UI text is German", () =>
  withBrowserLanguage("de-DE", async () => {
    render(<App />);
    const deck = JSON.stringify({ cards: [qa("a", 1)] });
    pick(new File([deck], "deck.json", { type: "application/json" }), "Deck hochladen");
    await screen.findByText("a (qa, Version 1)");

    expect(screen.getByLabelText("Sprache")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sitzung starten" })).toBeTruthy();
  }));

it("after a reload, the UI text is in the picked language, not the browser language", async () => {
  const { unmount } = render(<App />);
  pickGerman();
  await waitFor(async () => expect(await loadLanguage()).toBe("de"));
  unmount();

  render(<App />);

  await screen.findByLabelText("Sprache");
  expect(screen.getByText("Noch nichts heruntergeladen")).toBeTruthy();
});

function navLink(name: string) {
  return within(
    screen.getByRole("navigation", { name: /^(Pages|Seiten)$/ }),
  ).getByRole<HTMLButtonElement>("button", { name });
}

function goTo(name: string) {
  fireEvent.click(navLink(name));
}

function isCurrent(name: string) {
  return navLink(name).getAttribute("aria-current") === "page";
}

it("the header shows the brand, and the brand goes Home from Statistics", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  goTo("Statistics");
  await screen.findByRole("table", { name: "Cards" });
  expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();

  const brand = screen.getByRole("button", { name: "Flashcards home" });
  expect(brand.textContent).toBe("Flashcards");
  fireEvent.click(brand);

  expect(startButton()).toBeTruthy();
  expect(isCurrent("Home")).toBe(true);
  await expectListed(qa("a", 1));
});

it("the navigation marks Home at the start, and Statistics once it shows", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  expect(isCurrent("Home")).toBe(true);

  goTo("Statistics");

  await screen.findByRole("table", { name: "Cards" });
  expect(isCurrent("Statistics")).toBe(true);
  expect(isCurrent("Home")).toBe(false);
});

it.each(["Cards", "Settings"])("%s shows a placeholder until its page is built", (name) => {
  render(<App />);

  goTo(name);

  expect(screen.getByText("This page is not built yet.")).toBeTruthy();
  expect(isCurrent(name)).toBe(true);
  expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Flashcards" })).toBeTruthy();
});

it("shows the navigation and a placeholder in German", () => {
  render(<App />);
  pickGerman();

  const names = within(screen.getByRole("navigation", { name: "Seiten" }))
    .getAllByRole("button")
    .map((button) => button.textContent);
  expect(names).toEqual(["Start", "Karten", "Sitzung", "Statistik", "Einstellungen"]);
  expect(screen.getByRole("button", { name: "Flashcards-Startseite" })).toBeTruthy();
  goTo("Einstellungen");

  expect(screen.getByText("Diese Seite gibt es noch nicht.")).toBeTruthy();
});

it("Statistics from the navigation shows the figures, and Back goes Home", async () => {
  await addReview(review("a", 1, "2026-11-15T10:00:00.000Z"));
  render(<App />);
  await uploaded(qa("a", 1));

  goTo("Statistics");

  await screen.findByRole("table", { name: "Cards" });
  expect(rows("Cards")).toEqual([
    ["Card", "Reviews", "Share right", "Last reviewed"],
    ["a", "1", "100%", "11/15/2026"],
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(startButton()).toBeTruthy();
  expect(isCurrent("Home")).toBe(true);
});

it("Statistics from the navigation shows an error and stays Home when the Review log can't be loaded", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  blockStorage();

  goTo("Statistics");

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(startButton()).toBeTruthy();
  expect(isCurrent("Home")).toBe(true);
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});

it("disables the Session link with no Cards or with fewer than 1 Card, like Start Session", async () => {
  render(<App />);
  expect(navLink("Session").disabled).toBe(true);

  await uploaded(qa("a", 1));
  expect(navLink("Session").disabled).toBe(false);

  fireEvent.change(screen.getByLabelText("Cards"), { target: { value: "0" } });
  expect(navLink("Session").disabled).toBe(true);

  fireEvent.change(screen.getByLabelText("Cards"), { target: { value: "" } });
  expect(navLink("Session").disabled).toBe(true);
});

it("the Session link starts a Session with Home's Cards and Tag", async () => {
  render(<App />);
  await uploaded(
    tagged(qa("reg-1", 1), ["Statistics"], ["Regression"]),
    tagged(qa("reg-2", 1), ["Statistics"], ["Regression"]),
    tagged(qa("other", 1), ["Statistics"], ["Bias"]),
  );
  fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "Regression" } });
  fireEvent.change(screen.getByLabelText("Cards"), { target: { value: "1" } });

  goTo("Session");
  await answer();

  await screen.findByRole("button", { name: "Done" });
  expect(screen.getByText("1 answered, 1 right")).toBeTruthy();
  expect(isCurrent("Session")).toBe(true);
  await waitFor(async () =>
    expect((await loadReviews()).map((each) => each.cardId)).toEqual([
      expect.stringMatching(/^reg-/),
    ]),
  );
});

it("the Session link shows an error and starts no Session when the Review log can't be loaded", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  blockStorage();

  goTo("Session");

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(startButton()).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Reveal" })).toBeNull();
});

it("a running Session keeps its place while other pages show", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));
  startSession();
  await answer();
  fireEvent.click(await screen.findByRole("button", { name: "Reveal" }));

  goTo("Home");
  expect(startButton()).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Knew it" })).toBeNull();
  goTo("Statistics");
  await screen.findByRole("table", { name: "Cards" });
  goTo("Session");

  // The second Card is still revealed, so this is the same Session.
  expect(screen.queryByRole("button", { name: "Reveal" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Knew it" }));
  await screen.findByRole("button", { name: "Done" });
  expect(screen.getByText("2 answered, 2 right")).toBeTruthy();
});

it("the Session link stays enabled while a Session runs, even with 0 Cards set on Home", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  startSession();
  await screen.findByRole("button", { name: "Reveal" });
  goTo("Home");

  fireEvent.change(screen.getByLabelText("Cards"), { target: { value: "0" } });

  expect(navLink("Session").disabled).toBe(false);
  goTo("Session");
  expect(screen.getByRole("button", { name: "Reveal" })).toBeTruthy();
});

it("doesn't count the time spent on another page into the Card's time", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    render(<App />);
    await uploaded(qa("a", 1));
    vi.setSystemTime(new Date("2026-11-15T10:00:00.000Z"));

    startSession();
    fireEvent.click(await screen.findByRole("button", { name: "Reveal" }));
    vi.setSystemTime(new Date("2026-11-15T10:00:03.000Z"));
    goTo("Home");
    vi.setSystemTime(new Date("2026-11-15T10:00:10.000Z"));
    goTo("Session");
    vi.setSystemTime(new Date("2026-11-15T10:00:14.000Z"));
    fireEvent.click(screen.getByRole("button", { name: "Knew it" }));

    await waitFor(async () =>
      expect((await loadReviews()).map((each) => each.durationMs)).toEqual([4000]),
    );
  } finally {
    vi.useRealTimers();
  }
});

it("Start Session on Home replaces a running Session with a new one", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));
  startSession();
  await answer();
  goTo("Home");

  startSession();
  await answer();

  // The old Session would end here, after its second answer; the new one has a Card left.
  await screen.findByRole("button", { name: "Reveal" });
  expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  await answer();
  await screen.findByRole("button", { name: "Done" });
  expect(screen.getByText("2 answered, 2 right")).toBeTruthy();
});

it("Done goes Home, and the Session link then starts a new Session", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  startSession();
  await answer();
  fireEvent.click(await screen.findByRole("button", { name: "Done" }));
  expect(startButton()).toBeTruthy();
  expect(isCurrent("Home")).toBe(true);

  goTo("Session");

  await answer();
  await screen.findByRole("button", { name: "Done" });
  await waitFor(async () => expect(await loadReviews()).toHaveLength(2));
});

it("Statistics from the navigation reloads the Review log, even when left without Back", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  goTo("Statistics");
  await screen.findByRole("table", { name: "Cards" });
  expect(rows("Cards")[1]).toEqual(["a", "0", "–", "never"]);

  goTo("Home");
  startSession();
  await answer();
  await screen.findByRole("button", { name: "Done" });
  await waitFor(async () => expect(await loadReviews()).toHaveLength(1));
  goTo("Statistics");

  await waitFor(() => expect(rows("Cards")[1].slice(0, 3)).toEqual(["a", "1", "100%"]));
});

it("a finished Session keeps its summary until Done, so the Session link shows it again", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  startSession();
  await answer();
  await screen.findByRole("button", { name: "Done" });

  goTo("Home");
  expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  goTo("Session");

  expect(screen.getByText("1 answered, 1 right")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Reveal" })).toBeNull();
});
