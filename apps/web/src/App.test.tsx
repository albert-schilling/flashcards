import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "./App";
import { loadReviews } from "./storage";
import { qa, tagged, trueFalse } from "./test/cards";

function upload(...cards: TCard[]) {
  pick(new File([JSON.stringify({ cards })], "deck.json", { type: "application/json" }));
}

function pick(file: File) {
  const input = screen.getByLabelText<HTMLInputElement>("Upload Deck");
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
  globalThis.indexedDB = {
    open() {
      throw new DOMException("Storage is blocked.", "SecurityError");
    },
  } as unknown as IDBFactory;

  render(<App />);

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
});

it("shows an error when the file can't be read", async () => {
  const file = new File([], "deck.json");
  file.text = () => Promise.reject(new DOMException("The file is gone.", "NotReadableError"));
  render(<App />);

  pick(file);

  expect((await screen.findByRole("alert")).textContent).toContain("The file is gone.");
});

it("hides the report of the last upload when the next one fails", async () => {
  render(<App />);
  upload(qa("ml.trees.leaf-mean", 1));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);

  const file = new File([], "deck.json");
  file.text = () => Promise.reject(new DOMException("The file is gone.", "NotReadableError"));
  pick(file);

  await screen.findByRole("alert");
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
  globalThis.indexedDB = {
    open() {
      throw new DOMException("Storage is blocked.", "SecurityError");
    },
  } as unknown as IDBFactory;

  fireEvent.click(screen.getByRole("button", { name: "Delete ml.trees.leaf-mean" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  await expectListed(qa("ml.trees.leaf-mean", 1));
});

async function uploaded(...cards: TCard[]) {
  upload(...cards);
  await expectListed(cards[cards.length - 1]);
}

function startSession() {
  fireEvent.click(screen.getByRole("button", { name: "Start Session" }));
}

async function answer(knew = true) {
  fireEvent.click(await screen.findByRole("button", { name: "Reveal" }));
  fireEvent.click(screen.getByRole("button", { name: knew ? "Knew it" : "Didn't know" }));
}

function startButton() {
  return screen.getByRole<HTMLButtonElement>("button", { name: "Start Session" });
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

it("starts a Session with only the qa Cards of the picked tag", async () => {
  render(<App />);
  await uploaded(
    tagged(qa("reg-1", 1), ["Statistics"], ["Regression"]),
    tagged(qa("reg-2", 1), ["Regression"], ["Bias"]),
    tagged(qa("other", 1), ["Statistics"], ["Bias"]),
    tagged(trueFalse("logic", 1), ["Logic"], ["Logic"]),
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
  for (let i = 0; i < 2; i++) {
    await screen.findByRole("button", { name: "Reveal" });
    expect(screen.queryByText("What is other?")).toBeNull();
    await answer();
  }

  await screen.findByText(/2 answered, 2 right/);
});

it("a Session shows only qa Cards", async () => {
  render(<App />);
  await uploaded(trueFalse("logic", 1), qa("ml.trees.depth", 1));

  startSession();
  await answer();

  await screen.findByText(/1 answered, 1 right/);
});

it("disables Start Session without qa Cards or with fewer than 1 Card", async () => {
  render(<App />);
  await uploaded(trueFalse("logic", 1));
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

it("the summary counts Cards answered and right, and Done goes back", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1), qa("c", 1));

  startSession();
  await answer(true);
  await answer(false);
  await answer(true);

  await screen.findByText(/3 answered, 2 right/);
  await waitFor(async () =>
    expect((await loadReviews()).map((review) => review.right).sort()).toEqual([false, true, true]),
  );
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(startButton()).toBeTruthy();
  await expectListed(qa("a", 1));
});

it("shows an error when a Review can't be stored, and the Session goes on", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));
  startSession();
  globalThis.indexedDB = {
    open() {
      throw new DOMException("Storage is blocked.", "SecurityError");
    },
  } as unknown as IDBFactory;

  await answer();

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  await answer();
  await screen.findByText(/2 answered, 2 right/);
});

it("forgets a picked tag once no qa Card has it", async () => {
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
