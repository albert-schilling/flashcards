import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "./App";
import { addReview, loadLanguage } from "./storage";
import {
  download,
  goHome,
  goTo,
  isCurrent,
  levelOneHeadings,
  openCards,
  openDeleteAll,
  pick,
  startSession,
  uploaded,
} from "./test/app.helpers";
import { german, numeric, qa, review, trueFalse } from "./test/cards.fixtures";
import { openSettings, pickLanguage, withBrowserLanguage } from "./test/settings.helpers";
import { home, overview, rows } from "./test/statistics.helpers";

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
