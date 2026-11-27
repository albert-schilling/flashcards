import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "./App";
import { loadReviews } from "./storage";
import { startSession, uploaded } from "./test/app.helpers";
import { cloze, formula, multipleChoice, numeric, trueFalse } from "./test/cards.fixtures";

it.each([
  {
    case: "formula with an example, Knew it",
    card: formula("norm", 1, "norm of 2 and 3 is 6."),
    prompt: ["The norm formula", "norm is a times b."],
    answer: ["norm = a · b", "Example: norm of 2 and 3 is 6."],
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
    answer: ["deep", "high"],
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
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
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
