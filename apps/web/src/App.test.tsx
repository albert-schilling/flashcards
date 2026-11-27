import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { expect, it, vi } from "vitest";
import { App } from "./App";
import { addReview, loadLanguage, loadReviews } from "./storage";
import {
  answer,
  blockStorage,
  deleteFromRow,
  download,
  expectListed,
  expectNoDialog,
  goHome,
  goTo,
  isCurrent,
  levelOneHeadings,
  navLink,
  openCards,
  openDeleteAll,
  pick,
  startButton,
  startSession,
  upload,
  uploaded,
} from "./test/app.helpers";
import {
  cloze,
  formula,
  fullFormula,
  german,
  multipleChoice,
  numeric,
  qa,
  review,
  tagged,
  trueFalse,
} from "./test/cards.fixtures";
import {
  created,
  editor,
  expectSaved,
  fieldValue,
  fill,
  fillShared,
  openEditor,
  openPreview,
  pickCardType,
} from "./test/editor.helpers";
import {
  languageSelect,
  openSettings,
  pickLanguage,
  withBrowserLanguage,
} from "./test/settings.helpers";
import { home, overview, rows } from "./test/statistics.helpers";
import {
  checkNumber,
  clickOption,
  expectFeedback,
  optionMarks,
  reveal,
} from "./test/study.helpers";

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

function pickGerman() {
  pickLanguage("de");
}

// languageSelect() and startButton() match both languages, so this pins the English names.
it("labels the language select Language and the start button Start Session in English", async () => {
  render(<App />);
  await uploaded(qa("a", 1));

  expect(screen.getByRole("button", { name: "Start Session" })).toBeTruthy();
  openSettings();
  expect(screen.getByLabelText("Language")).toBeTruthy();
});

it("Home shows no Language select, with no Cards and after an upload", async () => {
  render(<App />);
  expect(screen.queryByLabelText(/^(Language|Sprache)$/)).toBeNull();

  await uploaded(qa("a", 1));

  expect(isCurrent("Home")).toBe(true);
  expect(screen.queryByLabelText(/^(Language|Sprache)$/)).toBeNull();
});

it("shows the start page and the Files panel in German once Deutsch is picked", async () => {
  render(<App />);
  await uploaded(qa("a", 1));

  pickGerman();

  expect(screen.getByLabelText("Karten")).toBeTruthy();
  const tag = screen.getByLabelText<HTMLSelectElement>("Tag");
  expect(tag.options[0].text).toBe("Alle Tags");
  for (const name of ["Sitzung starten", "Statistik"]) {
    expect(home().getByRole("button", { name })).toBeTruthy();
  }
  goTo("Karten");
  expect(screen.getByText("Sicherung")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 2, name: "Dateien" })).toBeTruthy();
  for (const name of ["Karten herunterladen", "Lernprotokoll herunterladen"]) {
    expect(screen.getByRole("button", { name })).toBeTruthy();
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

it("shows a Deck upload in German: the counts, then on Karten the Card list and its buttons", async () => {
  render(<App />);
  pickGerman();

  const deck = JSON.stringify({ cards: [german(qa("q", 1), { question: "Was ist q?" })] });
  pick(new File([deck], "deck.json", { type: "application/json" }), "Deck hochladen");

  await screen.findByText("1 hinzugefügt, 0 aktualisiert, 0 unverändert");
  goTo("Karten");
  expect(screen.getByText("1 von 1 Karte")).toBeTruthy();
  expect(screen.getByText("Was ist q?")).toBeTruthy();
  expect(screen.getByRole("button", { name: "q löschen" }).textContent).toBe("");
  expect(screen.getByRole("button", { name: "Alle Karten löschen" })).toBeTruthy();
});

it("shows the Cards page heading in German", () => {
  render(<App />);
  pickGerman();

  goTo("Karten");

  expect(levelOneHeadings()).toEqual(["Karten"]);
  expect(screen.getByText("Bibliothek")).toBeTruthy();
  expect(
    screen.getByText("Karten suchen, ordnen, ansehen und sichern, alles an einem Ort."),
  ).toBeTruthy();
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
  goTo("Karten");

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
  expect(screen.getByText("Sitzung abgeschlossen")).toBeTruthy();
  expect(screen.getByText("Gute Arbeit. Jede Wiederholung stärkt dein Wissen.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Zurück" })).toBeTruthy();
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
  expect(levelOneHeadings()).toEqual(["Statistik"]);
  expect(screen.getByText("Lernverlauf")).toBeTruthy();
  expect(overview("Statistik-Übersicht")).toEqual([
    ["2", "Karten"],
    ["1", "Wiederholungen"],
    ["100%", "Anteil richtig"],
  ]);
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
    await screen.findByText("1 hinzugefügt, 0 aktualisiert, 0 unverändert");
    goHome();

    expect(screen.getByRole("button", { name: "Sitzung starten" })).toBeTruthy();
    openSettings();
    expect(screen.getByLabelText("Sprache")).toBeTruthy();
  }));

it("after a reload, the UI text is in the picked language, not the browser language", async () => {
  const { unmount } = render(<App />);
  pickGerman();
  await waitFor(async () => expect(await loadLanguage()).toBe("de"));
  unmount();

  render(<App />);

  await screen.findByText("Willkommen zurück");
  openCards();
  expect(screen.getByText("Noch nichts heruntergeladen")).toBeTruthy();
});

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

it("Settings shows its heading and the Interface panel with the Language select", () => {
  render(<App />);

  goTo("Settings");

  expect(isCurrent("Settings")).toBe(true);
  expect(levelOneHeadings()).toEqual(["Settings"]);
  expect(screen.getByText("Language settings")).toBeTruthy();
  expect(screen.getByText("Choose how Flashcards appears in this browser.")).toBeTruthy();
  expect(screen.getByText("Interface")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 2, name: "Language" })).toBeTruthy();
  expect(Array.from(languageSelect().options, (option) => option.text)).toEqual([
    "English",
    "Deutsch",
  ]);
  expect(screen.getByText("The interface and Card texts update immediately.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();
});

it("the Cards page shows the Library heading and the Card count", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));

  goTo("Cards");

  expect(isCurrent("Cards")).toBe(true);
  expect(levelOneHeadings()).toEqual(["Cards"]);
  expect(screen.getByText("Library")).toBeTruthy();
  expect(
    screen.getByText("Search, organize, preview, and back up every Card in one place."),
  ).toBeTruthy();
  expect(screen.getByText("2 of 2 Cards")).toBeTruthy();
  expect(screen.getByText("What is a?")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();
});

it("the Cards page search, Type and Tag reset when the Learner leaves the page and comes back", async () => {
  render(<App />);
  await uploaded(
    tagged(qa("a", 1), ["Statistics"], ["Regression"]),
    tagged(formula("b", 1), ["Machine Learning"], ["Decision Tree"]),
  );
  openCards();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search Cards" }), {
    target: { value: "b" },
  });
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "formula" } });
  fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "Decision Tree" } });
  expect(screen.getByText("1 of 2 Cards")).toBeTruthy();

  goHome();
  openCards();

  expect(screen.getByRole<HTMLInputElement>("searchbox", { name: "Search Cards" }).value).toBe("");
  expect(screen.getByLabelText<HTMLSelectElement>("Type").value).toBe("");
  expect(screen.getByLabelText<HTMLSelectElement>("Tag").value).toBe("");
  expect(screen.getByText("2 of 2 Cards")).toBeTruthy();
});

it("Home shows neither the Card list, Delete all Cards nor the Files panel", async () => {
  render(<App />);
  await uploaded(qa("a", 1));

  expect(isCurrent("Home")).toBe(true);
  expect(screen.queryByRole("button", { name: "Delete a" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Delete all Cards" })).toBeNull();
  expect(screen.queryByText("a")).toBeNull();
  expect(screen.queryByText("What is a?")).toBeNull();
  expect(screen.queryByLabelText("Upload Deck")).toBeNull();
  expect(screen.queryByLabelText("Upload Review log")).toBeNull();
  expect(screen.queryByRole("button", { name: "Download Cards" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Download Review log" })).toBeNull();
  expect(screen.queryByText("No download yet")).toBeNull();
  expect(screen.queryByText(/1 added, 0 updated, 0 unchanged/)).toBeNull();
});

it("picking Deutsch on Settings shows Settings and the navigation in German at once", () => {
  render(<App />);
  openSettings();

  fireEvent.change(languageSelect(), { target: { value: "de" } });

  expect(isCurrent("Einstellungen")).toBe(true);
  expect(levelOneHeadings()).toEqual(["Einstellungen"]);
  expect(screen.getByText("Spracheinstellungen")).toBeTruthy();
  expect(screen.getByText("Wähle, wie Flashcards in diesem Browser aussieht.")).toBeTruthy();
  expect(screen.getByText("Oberfläche")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 2, name: "Sprache" })).toBeTruthy();
  expect(screen.getByLabelText<HTMLSelectElement>("Sprache").value).toBe("de");
  expect(screen.getByText("Oberfläche und Kartentexte ändern sich sofort.")).toBeTruthy();
  const names = within(screen.getByRole("navigation", { name: "Seiten" }))
    .getAllByRole("button")
    .map((button) => button.textContent);
  expect(names).toEqual(["Start", "Karten", "Sitzung", "Statistik", "Einstellungen"]);
  expect(screen.getByRole("button", { name: "Flashcards-Startseite" })).toBeTruthy();
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

it("Back leaves the Session for Home; the answers given stay in the Review log and the Session keeps its place", async () => {
  render(<App />);
  await uploaded(qa("a", 1), qa("b", 1));
  startSession();
  await answer();

  fireEvent.click(await screen.findByRole("button", { name: "Back" }));

  expect(startButton()).toBeTruthy();
  expect(isCurrent("Home")).toBe(true);
  await waitFor(async () => expect(await loadReviews()).toHaveLength(1));
  goTo("Session");
  expect(screen.getByText("2 / 2")).toBeTruthy();
});

it("Back on the summary goes Home without ending the Session; the Session link shows the summary again", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  startSession();
  await answer();
  await screen.findByRole("button", { name: "Done" });

  fireEvent.click(screen.getByRole("button", { name: "Back" }));

  expect(isCurrent("Home")).toBe(true);
  goTo("Session");
  expect(screen.getByText("1 answered, 1 right")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
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

/** The labels of the editor's fields, in order. */
function fieldLabels(dialog: HTMLElement) {
  return [...dialog.querySelectorAll("label")].map((label) => label.textContent);
}

/** The error text under this field, from the elements that describe it; null when it has none. */
function fieldError(field: HTMLElement): string | null {
  const ids = field.getAttribute("aria-describedby")?.split(" ") ?? [];
  const error = ids
    .map((id) => document.getElementById(id))
    .find((element) => element?.classList.contains("field-error"));
  return error?.textContent ?? null;
}

/** The labels of the fields marked invalid, in order; each must show an error text. */
function invalidFields(dialog: HTMLElement) {
  return [...dialog.querySelectorAll<HTMLInputElement>('[aria-invalid="true"]')].map((field) => {
    expect(fieldError(field)).toBeTruthy();
    return field.labels![0].textContent;
  });
}

/** Opens this Card's preview on the Cards page and presses Edit there. */
function openEdit(id: string) {
  openCards();
  fireEvent.click(openPreview(id).getByRole("button", { name: "Edit" }));
  return editor("Edit Card");
}

it.each(created)(
  "Create Card on the Cards page makes a $type Card, shows Card saved. and its preview, and keeps it after a reload",
  async ({ fillType, card, answer }) => {
    const { unmount } = render(<App />);
    const dialog = openEditor();
    fillType(dialog);
    fillShared(dialog);

    fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

    await expectSaved();
    const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
    expect(preview.getByText(`${card.id} · version 1`)).toBeTruthy();
    expect(preview.getByText(answer)).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Create Card" })).toBeNull();
    fireEvent.click(preview.getByRole("button", { name: "Close" }));
    await screen.findByText(card.id);
    unmount();
    render(<App />);
    await expectListed(card as TCard);
  },
);

it("a created Card is in Download Cards like an uploaded one, and the file uploads again unchanged", async () => {
  render(<App />);
  const dialog = openEditor();
  created[0].fillType(dialog);
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  const file = await download("Download Cards");

  expect(JSON.parse(await file.text()).cards).toEqual([
    {
      id: "what-is-the-leaf-mean",
      version: 1,
      tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      type: "qa",
      en: { question: "What is the leaf mean?", answer: "The mean of its targets." },
    },
  ]);
  pick(file, "Upload Deck");
  await screen.findByText(/0 added, 0 updated, 1 unchanged/);
});

it("a formula Card created with every field has them all in Download Cards: the texts in English and German, Formula and LaTeX once", async () => {
  render(<App />);
  const dialog = openEditor();
  created[3].fillType(dialog);
  fill(dialog, "Read aloud", "norm of x");
  fill(dialog, "Example", "|(3, 4)| = 5");
  fill(dialog, "LaTeX", "\\lVert x \\rVert");
  fill(dialog, "Name (German)", "Vektornorm");
  fill(dialog, "Word formula (German)", "Die Wurzel der summierten Quadrate.");
  fill(dialog, "Read aloud (German)", "Norm von x");
  fill(dialog, "Example (German)", "|(3, 4)| ist 5");
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  const file = await download("Download Cards");

  expect(JSON.parse(await file.text()).cards).toEqual([
    {
      id: "vector-norm",
      version: 1,
      tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      type: "formula",
      en: {
        name: "Vector norm",
        wordFormula: "The root of the summed squares.",
        readAloud: "norm of x",
        example: "|(3, 4)| = 5",
      },
      translations: {
        de: {
          name: "Vektornorm",
          wordFormula: "Die Wurzel der summierten Quadrate.",
          readAloud: "Norm von x",
          example: "|(3, 4)| ist 5",
        },
      },
      formula: "|x| = √(x₁² + x₂²)",
      latex: "\\lVert x \\rVert",
    },
  ]);
});

it("a formula Card created with an example reveals its formula and example in a Session", async () => {
  render(<App />);
  const dialog = openEditor();
  created[3].fillType(dialog);
  fill(dialog, "Example", "|(3, 4)| = 5");
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  goHome();
  startSession();
  const article = await screen.findByRole("article");

  reveal(article);

  expect(article.querySelector(".revealed-answer .formula")?.textContent).toBe(
    "|x| = √(x₁² + x₂²)",
  );
  expect(article.querySelector(".revealed-answer .example")?.textContent).toBe(
    "Example: |(3, 4)| = 5",
  );
});

it.each([
  { typed: "5", word: "Right.", right: true },
  { typed: "6", word: "Wrong.", right: false },
])(
  "a numeric Card created with Answer 5 and Allowed error 0.01 counts $typed as $word in a Session",
  async ({ typed, word, right }) => {
    render(<App />);
    const dialog = openEditor();
    created[4].fillType(dialog);
    fillShared(dialog);
    fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
    await expectSaved();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    goHome();
    startSession();
    const article = await screen.findByRole("article");

    checkNumber(article, typed);

    expectFeedback(article, word, right);
  },
);

it("a multiple_choice Card created with Option 2 marked right marks it right in a Session", async () => {
  render(<App />);
  const dialog = openEditor();
  created[5].fillType(dialog);
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  goHome();
  startSession();
  const article = await screen.findByRole("article");

  clickOption(article, "A leaf");

  expect(optionMarks(article)).toEqual(["A", "correct check"]);
  expectFeedback(article, "Right.", true);
});

it("a multiple_choice Card made with three options in English and German, the third marked right and the first removed, has the other two in Download Cards with the third still right", async () => {
  render(<App />);
  const dialog = openEditor();
  pickCardType(dialog, "multiple_choice");
  fill(dialog, "Question", "Which node predicts?");
  fill(dialog, "Explanation", "A leaf predicts the mean.");
  fill(dialog, "Question (German)", "Welcher Knoten sagt voraus?");
  fill(dialog, "Explanation (German)", "Ein Blatt sagt den Mittelwert voraus.");
  fill(dialog, "Option 1", "The root");
  fill(dialog, "Option 1 (German)", "Die Wurzel");
  fill(dialog, "Option 2", "A split");
  fill(dialog, "Option 2 (German)", "Ein Split");
  fireEvent.click(dialog.getByRole("button", { name: "Add option" }));
  fill(dialog, "Option 3", "A leaf");
  fill(dialog, "Option 3 (German)", "Ein Blatt");
  fireEvent.click(dialog.getByLabelText("Option 3 is right"));

  fireEvent.click(dialog.getByRole("button", { name: "Remove option 1" }));

  expect(dialog.queryByLabelText("Option 3")).toBeNull();
  expect(fieldValue(dialog, "Option 1")).toBe("A split");
  expect(fieldValue(dialog, "Option 2")).toBe("A leaf");
  expect(fieldValue(dialog, "Option 2 (German)")).toBe("Ein Blatt");
  expect(dialog.getByLabelText<HTMLInputElement>("Option 2 is right").checked).toBe(true);
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  const file = await download("Download Cards");
  expect(JSON.parse(await file.text()).cards).toEqual([
    {
      id: "which-node-predicts",
      version: 1,
      tags: { domain: ["Machine Learning", "Statistics"], topic: ["Decision Tree"] },
      sourceIds: [],
      lesson: "lesson-04",
      type: "multiple_choice",
      en: {
        question: "Which node predicts?",
        options: ["A split", "A leaf"],
        explanation: "A leaf predicts the mean.",
      },
      translations: {
        de: {
          question: "Welcher Knoten sagt voraus?",
          options: ["Ein Split", "Ein Blatt"],
          explanation: "Ein Blatt sagt den Mittelwert voraus.",
        },
      },
      answerIndex: 1,
    },
  ]);
});

it("the editor shows the picked type's fields, then its German fields, tags, Lesson and ID, and keeps what was typed across types", () => {
  render(<App />);
  const dialog = openEditor();
  const element = screen.getByRole("dialog", { name: "Create Card" });
  const shared = ["Domain tags", "Topic tags", "Lesson", "ID"];
  const select = dialog.getByLabelText<HTMLSelectElement>("Type");
  expect([...select.options].map((option) => option.value)).toEqual([
    "qa",
    "cloze",
    "true_false",
    "formula",
    "numeric",
    "multiple_choice",
  ]);
  expect(select.value).toBe("qa");
  expect(fieldLabels(element)).toEqual([
    "Type",
    "Question",
    "Answer",
    "Question (German)",
    "Answer (German)",
    ...shared,
  ]);
  fill(dialog, "Question", "What is the leaf mean?");

  pickCardType(dialog, "cloze");
  expect(fieldLabels(element)).toEqual(["Type", "Text", "Text (German)", ...shared]);
  pickCardType(dialog, "true_false");
  expect(fieldLabels(element)).toEqual([
    "Type",
    "Statement",
    "Answer",
    "Statement (German)",
    ...shared,
  ]);
  expect(dialog.getByLabelText("Answer").tagName).toBe("SELECT");
  fill(dialog, "Statement", "A leaf is a node.");
  pickCardType(dialog, "formula");
  expect(fieldLabels(element)).toEqual([
    "Type",
    "Name",
    "Word formula",
    "Read aloud",
    "Example",
    "Formula",
    "LaTeX",
    "Name (German)",
    "Word formula (German)",
    "Read aloud (German)",
    "Example (German)",
    ...shared,
  ]);
  fill(dialog, "Name", "Vector norm");
  fill(dialog, "Formula", "|x| = √(x₁² + x₂²)");
  pickCardType(dialog, "numeric");
  expect(fieldLabels(element)).toEqual([
    "Type",
    "Question",
    "Answer",
    "Allowed error",
    "Unit",
    "Question (German)",
    ...shared,
  ]);
  fill(dialog, "Answer", "9.81");
  pickCardType(dialog, "multiple_choice");
  expect(fieldLabels(element)).toEqual([
    "Type",
    "Question",
    "Explanation",
    "Option 1",
    "Option 1 (German)",
    "Option 2",
    "Option 2 (German)",
    "Question (German)",
    "Explanation (German)",
    ...shared,
  ]);
  expect(fieldValue(dialog, "Question")).toBe("What is the leaf mean?");
  pickCardType(dialog, "qa");

  expect(fieldValue(dialog, "Question")).toBe("What is the leaf mean?");
  pickCardType(dialog, "true_false");
  expect(fieldValue(dialog, "Statement")).toBe("A leaf is a node.");
  pickCardType(dialog, "formula");
  expect(fieldValue(dialog, "Name")).toBe("Vector norm");
  expect(fieldValue(dialog, "Formula")).toBe("|x| = √(x₁² + x₂²)");
  pickCardType(dialog, "numeric");
  expect(fieldValue(dialog, "Question")).toBe("What is the leaf mean?");
  expect(fieldValue(dialog, "Answer")).toBe("9.81");
});

it("the ID follows the question until the Learner types one", () => {
  render(<App />);
  const dialog = openEditor();
  expect(fieldValue(dialog, "ID")).toBe("");

  fill(dialog, "Question", "What is the leaf mean?");
  expect(fieldValue(dialog, "ID")).toBe("what-is-the-leaf-mean");
  fill(dialog, "Question", "How deep is a tree?");
  expect(fieldValue(dialog, "ID")).toBe("how-deep-is-a-tree");

  fill(dialog, "ID", "ml.trees.depth");
  fill(dialog, "Question", "How deep can a tree grow?");
  expect(fieldValue(dialog, "ID")).toBe("ml.trees.depth");
});

it("with no Cards, Home's Create Card opens the Card editor on the Cards page, only that once", async () => {
  render(<App />);

  fireEvent.click(home().getByRole("button", { name: "Create Card" }));

  expect(isCurrent("Cards")).toBe(true);
  fireEvent.click(editor().getByRole("button", { name: "Cancel" }));
  await expectNoDialog();
  goHome();
  openCards();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("Cancel closes the Card editor and stores nothing, also after a reload", async () => {
  const { unmount } = render(<App />);
  const dialog = openEditor();
  created[0].fillType(dialog);
  fillShared(dialog);

  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

  await expectNoDialog();
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
  expect(screen.queryByText("Card saved.")).toBeNull();
  unmount();
  render(<App />);
  // An empty list proves nothing before the reload finishes; "1 added" shows storage was empty.
  upload(qa("ml.trees.depth", 1));
  await screen.findByText(/1 added, 0 updated, 0 unchanged/);
  expect(screen.queryByText("what-is-the-leaf-mean")).toBeNull();
});

it("Create Card with empty fields marks each with its error after Save and stores nothing; fixing a field clears its error", async () => {
  render(<App />);
  const dialog = openEditor();
  const element = screen.getByRole("dialog", { name: "Create Card" });
  expect(invalidFields(element)).toEqual([]);

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(element)).toEqual([
    "Question",
    "Answer",
    "Domain tags",
    "Topic tags",
    "Lesson",
    "ID",
  ]);
  expect(screen.queryByText("Card saved.")).toBeNull();
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
  // The ID follows the question, so it is fixed too.
  fill(dialog, "Question", "What is the leaf mean?");
  expect(invalidFields(element)).toEqual(["Answer", "Domain tags", "Topic tags", "Lesson"]);
  expect(fieldError(dialog.getByLabelText("Question"))).toBeNull();
});

it("Create Card for a formula with empty fields marks Name, Word formula and Formula as empty, but not the optional fields", () => {
  render(<App />);
  const dialog = openEditor();
  const element = screen.getByRole("dialog", { name: "Create Card" });
  pickCardType(dialog, "formula");

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(element)).toEqual([
    "Name",
    "Word formula",
    "Formula",
    "Domain tags",
    "Topic tags",
    "Lesson",
    "ID",
  ]);
  for (const field of ["Name", "Word formula", "Formula"]) {
    expect(fieldError(dialog.getByLabelText(field))).toBe("This field can't be empty.");
  }
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
});

it("Create Card for a numeric Card marks a blank Answer as empty and a negative Allowed error as negative, but not the empty Unit", () => {
  render(<App />);
  const dialog = openEditor();
  const element = screen.getByRole("dialog", { name: "Create Card" });
  pickCardType(dialog, "numeric");
  fill(dialog, "Allowed error", "-0.5");

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(element)).toEqual([
    "Question",
    "Answer",
    "Allowed error",
    "Domain tags",
    "Topic tags",
    "Lesson",
    "ID",
  ]);
  expect(fieldError(dialog.getByLabelText("Answer"))).toBe("This field can't be empty.");
  expect(fieldError(dialog.getByLabelText("Allowed error"))).toBe(
    "The allowed error can't be negative.",
  );
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
});

it("Create Card for a multiple_choice Card marks blank options as empty, and blank German options once one is filled", () => {
  render(<App />);
  const dialog = openEditor();
  const element = screen.getByRole("dialog", { name: "Create Card" });
  pickCardType(dialog, "multiple_choice");
  fill(dialog, "Option 1 (German)", "Die Wurzel");

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(element)).toEqual([
    "Question",
    "Explanation",
    "Option 1",
    "Option 2",
    "Option 2 (German)",
    "Domain tags",
    "Topic tags",
    "Lesson",
    "ID",
  ]);
  for (const field of ["Option 1", "Option 2", "Option 2 (German)"]) {
    expect(fieldError(dialog.getByLabelText(field))).toBe("This field can't be empty.");
  }
  expect(fieldError(dialog.getByLabelText("Option 1 (German)"))).toBeNull();
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
});

it.each([
  { field: "Text", value: "A leaf predicts the mean." },
  { field: "Text (German)", value: "Ein Blatt sagt den Mittelwert voraus." },
])("Create Card shows an error under $field for a cloze without a gap", ({ field, value }) => {
  render(<App />);
  const dialog = openEditor();
  pickCardType(dialog, "cloze");
  fill(dialog, "Text", "A leaf predicts the {{mean}}.");
  fill(dialog, field, value);
  fillShared(dialog);

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(screen.getByRole("dialog", { name: "Create Card" }))).toEqual([field]);
});

it("Create Card with the ID of a stored Card shows Another Card has this ID. and keeps the stored Card", async () => {
  render(<App />);
  await uploaded(qa("ml.trees.depth", 1));
  const dialog = openEditor();
  created[0].fillType(dialog);
  fillShared(dialog);
  fill(dialog, "ID", "ml.trees.depth");

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect(invalidFields(screen.getByRole("dialog", { name: "Create Card" }))).toEqual(["ID"]);
  expect(fieldError(dialog.getByLabelText("ID"))).toBe("Another Card has this ID.");
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  expect(openPreview("ml.trees.depth").getByText("An answer.")).toBeTruthy();
});

it("closes the Card editor before saving, so a failure shows in the page's error and nothing is stored", async () => {
  render(<App />);
  const dialog = openEditor();
  created[0].fillType(dialog);
  fillShared(dialog);
  blockStorage();

  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Storage is blocked.");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("Card saved.")).toBeNull();
  expect(screen.getByText("0 of 0 Cards")).toBeTruthy();
});

it("Card saved. and Card deleted. share one notice", async () => {
  render(<App />);
  await uploaded(qa("ml.trees.depth", 1));
  const dialog = openEditor();
  created[0].fillType(dialog);
  fillShared(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Create Card" }));
  await expectSaved();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  deleteFromRow("ml.trees.depth");

  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Card deleted."));
  expect(screen.queryByText("Card saved.")).toBeNull();
});

const edited = german(
  tagged(qa("ml.trees.leaf-mean", 1), ["Machine Learning", "Statistics"], ["Decision Tree"]),
  {
    question: "Was ist ml.trees.leaf-mean?",
    answer: "Eine Antwort.",
  },
);

it("Edit in the preview opens the Card's fields with the ID disabled; Save changes raises the version, also after a reload", async () => {
  const { unmount } = render(<App />);
  await uploaded(edited);

  const dialog = openEdit("ml.trees.leaf-mean");

  expect(screen.queryByRole("dialog", { name: "Card preview" })).toBeNull();
  expect(fieldValue(dialog, "Type")).toBe("qa");
  expect(fieldValue(dialog, "Question")).toBe("What is ml.trees.leaf-mean?");
  expect(fieldValue(dialog, "Answer")).toBe("An answer.");
  expect(fieldValue(dialog, "Question (German)")).toBe("Was ist ml.trees.leaf-mean?");
  expect(fieldValue(dialog, "Answer (German)")).toBe("Eine Antwort.");
  expect(fieldValue(dialog, "Domain tags")).toBe("Machine Learning, Statistics");
  expect(fieldValue(dialog, "Topic tags")).toBe("Decision Tree");
  expect(fieldValue(dialog, "Lesson")).toBe("lesson-04");
  expect(fieldValue(dialog, "ID")).toBe("ml.trees.leaf-mean");
  expect(dialog.getByLabelText<HTMLInputElement>("ID").disabled).toBe(true);

  fill(dialog, "Answer", "The mean of its targets.");
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

  await expectSaved();
  const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
  expect(preview.getByText("ml.trees.leaf-mean · version 2")).toBeTruthy();
  expect(preview.getByText("The mean of its targets.")).toBeTruthy();
  unmount();
  render(<App />);
  await expectListed(edited);
  expect(
    openPreview("ml.trees.leaf-mean").getByText("ml.trees.leaf-mean · version 2"),
  ).toBeTruthy();
});

it("Save changes with nothing changed keeps the version", async () => {
  render(<App />);
  await uploaded(edited);
  const dialog = openEdit("ml.trees.leaf-mean");

  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

  await expectSaved();
  const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
  expect(preview.getByText("ml.trees.leaf-mean · version 1")).toBeTruthy();
});

it("Edit on a formula Card changes its Formula; Save changes raises the version and the preview shows the new formula", async () => {
  render(<App />);
  await uploaded(fullFormula("norm", 1));
  const dialog = openEdit("norm");
  expect(fieldValue(dialog, "Formula")).toBe("norm = a · b");
  expect(fieldValue(dialog, "LaTeX")).toBe("norm = a \\cdot b");

  fill(dialog, "Formula", "norm = b · a");
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

  await expectSaved();
  const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
  expect(preview.getByText("norm · version 2")).toBeTruthy();
  expect(preview.getByText("norm = b · a")).toBeTruthy();
  expect(preview.getByText("2 · 3 = 6")).toBeTruthy();
});

it("Edit on a numeric Card changes its Answer; Save changes raises the version and the preview shows the new answer with the unit", async () => {
  render(<App />);
  await uploaded(numeric("n", 1, "cm"));
  const dialog = openEdit("n");
  expect(fieldValue(dialog, "Answer")).toBe("5");
  expect(fieldValue(dialog, "Allowed error")).toBe("0.01");
  expect(fieldValue(dialog, "Unit")).toBe("cm");

  fill(dialog, "Answer", "7");
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

  await expectSaved();
  const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
  expect(preview.getByText("n · version 2")).toBeTruthy();
  expect(preview.getByText("7 cm")).toBeTruthy();
});

it("Edit on a multiple_choice Card with two options disables Remove until Add option; a third option marked right is saved as a new version", async () => {
  render(<App />);
  await uploaded(multipleChoice("mc", 1));
  const dialog = openEdit("mc");
  const removeButtons = () =>
    [1, 2].map(
      (n) => dialog.getByRole<HTMLButtonElement>("button", { name: `Remove option ${n}` }).disabled,
    );
  expect(fieldValue(dialog, "Option 1")).toBe("This");
  expect(fieldValue(dialog, "Option 2")).toBe("That");
  expect(removeButtons()).toEqual([true, true]);

  fireEvent.click(dialog.getByRole("button", { name: "Add option" }));

  expect(removeButtons()).toEqual([false, false]);
  expect(fieldValue(dialog, "Option 3")).toBe("");
  fill(dialog, "Option 3", "Neither");
  fireEvent.click(dialog.getByLabelText("Option 3 is right"));
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

  await expectSaved();
  const preview = within(await screen.findByRole("dialog", { name: "Card preview" }));
  expect(preview.getByText("mc · version 2")).toBeTruthy();
  expect(preview.getByText("Neither")).toBeTruthy();
});

it("after an edit, Statistics no longer count the Reviews of the Card's older version", async () => {
  render(<App />);
  await uploaded(qa("a", 1));
  startSession();
  await answer();
  goTo("Statistics");
  await screen.findByRole("table", { name: "Cards" });
  expect(overview()[1]).toEqual(["1", "Reviews"]);

  const dialog = openEdit("a");
  fill(dialog, "Answer", "Another answer.");
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
  await expectSaved();
  goTo("Statistics");

  await screen.findByRole("table", { name: "Cards" });
  expect(overview()).toEqual([
    ["1", "Cards"],
    ["0", "Reviews"],
    ["–", "Share right"],
  ]);
});
