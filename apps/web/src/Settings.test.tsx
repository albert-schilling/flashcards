import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { expect, it } from "vitest";
import { App } from "./App";
import { loadLanguage } from "./storage";
import { blockStorage, goHome, startSession, uploaded } from "./test/app.helpers";
import { cloze, formula, german, multipleChoice, qa, trueFalse } from "./test/cards.fixtures";
import {
  languageSelect,
  openSettings,
  pickLanguage,
  withBrowserLanguage,
} from "./test/settings.helpers";

it.each([
  ["de-DE", "de"],
  ["de", "de"],
  ["en-US", "en"],
  ["fr-FR", "en"],
  ["DE-AT", "de"],
])("with browser language %s, the language is %s until the Learner picks one", (browser, shown) =>
  withBrowserLanguage(browser, async () => {
    render(<App />);
    openSettings();

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

    pickLanguage("en");

    await waitFor(async () => expect(await loadLanguage()).toBe("en"));
    unmount();
    render(<App />);
    openSettings();
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
    after: ["tiefer"],
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
  pickLanguage(c.language);

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
  openSettings();

  fireEvent.change(languageSelect(), { target: { value: "de" } });

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(languageSelect().value).toBe("de");
  // Storage works again, so the Session can load the Review log.
  globalThis.indexedDB = new IDBFactory();
  goHome();
  startSession();
  await screen.findByText("Was ist q?");
});

it("clears the error once the picked language is saved", async () => {
  render(<App />);
  await uploaded(qa("q", 1));
  blockStorage();
  openSettings();
  fireEvent.change(languageSelect(), { target: { value: "de" } });
  await screen.findByRole("alert");
  globalThis.indexedDB = new IDBFactory();

  fireEvent.change(languageSelect(), { target: { value: "en" } });

  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
