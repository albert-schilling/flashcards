import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "./App";
import { addReview, loadReviews } from "./storage";
import {
  answer,
  blockStorage,
  expectListed,
  goHome,
  goTo,
  isCurrent,
  levelOneHeadings,
  navLink,
  openCards,
  startButton,
  startSession,
  uploaded,
} from "./test/app.helpers";
import { formula, qa, review, tagged } from "./test/cards.fixtures";
import { languageSelect, openSettings } from "./test/settings.helpers";
import { rows } from "./test/statistics.helpers";

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
