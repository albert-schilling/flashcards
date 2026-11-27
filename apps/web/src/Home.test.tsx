import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { addReview } from "./storage";
import {
  answer,
  blockStorage,
  deleteFromRow,
  expectNotListed,
  goHome,
  isCurrent,
  levelOneHeadings,
  openCards,
  startButton,
  startSession,
  uploaded,
} from "./test/app.helpers";
import { qa, tagged } from "./test/cards.fixtures";
import { home } from "./test/statistics.helpers";

describe("start page", () => {
  it("renders the start page with the app name", () => {
    render(<App />);

    const heading = screen.getByRole("heading", { name: "Flashcards" });

    expect(heading.textContent).toBe("Flashcards");
  });

  it("Home's heading welcomes back, with Flashcards as its only level-1 heading", () => {
    render(<App />);

    expect(levelOneHeadings()).toEqual(["Flashcards"]);
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByText("A calm routine for durable learning.")).toBeTruthy();
  });
});

describe("Start Session", () => {
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
});

describe("Home panels", () => {
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
    expect(screen.getByRole("heading", { level: 1, name: "Cards" })).toBeTruthy();
  });

  it("the Card count on Home reads 1 Card for one Card", async () => {
    render(<App />);
    await uploaded(qa("a", 1));

    expect(home().getByRole("button", { name: /^1 Card(?!s)/ })).toBeTruthy();
  });

  it("the Card count follows a deleted Card, and deleting the last one shows the empty state", async () => {
    render(<App />);
    await uploaded(qa("a", 1), qa("b", 1));

    openCards();
    deleteFromRow("a");
    await expectNotListed(qa("a", 1));
    goHome();
    expect(home().getByRole("button", { name: /^1 Card(?!s)/ })).toBeTruthy();

    openCards();
    deleteFromRow("b");
    await expectNotListed(qa("b", 1));
    goHome();
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

  // Upload Deck opens the Cards page for its Files panel; Create Card opens it with the Card editor.
  it.each(["Upload Deck", "Create Card"])("with no Cards, %s opens the Cards page", (name) => {
    render(<App />);

    fireEvent.click(home().getByRole("button", { name }));

    expect(isCurrent("Cards")).toBe(true);
    expect(screen.getByRole("heading", { level: 1, name: "Cards" })).toBeTruthy();
  });

  it("hides the upload, the Card list and the Flashcards heading during a Session", async () => {
    render(<App />);
    await uploaded(qa("ml.trees.depth", 1));

    startSession();

    await screen.findByRole("button", { name: "Reveal" });
    expect(screen.queryByRole("heading", { name: "Flashcards" })).toBeNull();
    expect(screen.queryByLabelText("Upload Deck")).toBeNull();
    expect(screen.queryByText("ml.trees.depth")).toBeNull();
  });
});
