import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Header, type TPage } from "./Header";
import { LanguageContext } from "./language.context";

/** Renders the Header and returns its onNavigate mock. */
function renderHeader(props: { page?: TPage; sessionDisabled?: boolean } = {}) {
  const onNavigate = vi.fn();
  render(
    <Header
      page={props.page ?? "home"}
      onNavigate={onNavigate}
      sessionDisabled={props.sessionDisabled ?? false}
    />,
  );
  return onNavigate;
}

function menuButton() {
  return screen.getByRole("button", { name: "Open navigation" });
}

function navigation() {
  return screen.getByRole("navigation", { name: "Pages" });
}

function link(name: string) {
  return within(navigation()).getByRole<HTMLButtonElement>("button", { name });
}

// On phones the style sheet shows the nav only with is-open; jsdom applies no CSS, so the class stands for it.
function expectMenuOpen(open: boolean) {
  expect(menuButton().getAttribute("aria-expanded")).toBe(String(open));
  expect(navigation().classList.contains("is-open")).toBe(open);
}

it("shows the brand mark and Flashcards in a button named Flashcards home", () => {
  renderHeader();

  const brand = screen.getByRole("button", { name: "Flashcards home" });

  expect(brand.textContent).toBe("Flashcards");
  expect(brand.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

it("lists Home, Cards, Session, Statistics and Settings in the navigation", () => {
  renderHeader();

  const names = within(navigation())
    .getAllByRole("button")
    .map((button) => button.textContent);

  expect(names).toEqual(["Home", "Cards", "Session", "Statistics", "Settings"]);
});

it("marks only the current page", () => {
  renderHeader({ page: "statistics" });

  expect(link("Statistics").getAttribute("aria-current")).toBe("page");
  for (const name of ["Home", "Cards", "Session", "Settings"]) {
    expect(link(name).getAttribute("aria-current")).toBeNull();
  }
});

it("disables the Session link when told to", () => {
  renderHeader({ sessionDisabled: true });

  expect(link("Session").disabled).toBe(true);
  expect(link("Statistics").disabled).toBe(false);
});

it("starts with the menu closed, and the menu button opens and closes it", () => {
  renderHeader();
  expectMenuOpen(false);

  fireEvent.click(menuButton());
  expectMenuOpen(true);

  fireEvent.click(menuButton());
  expectMenuOpen(false);
});

it.each<[string, TPage]>([
  ["Home", "home"],
  ["Cards", "cards"],
  ["Session", "session"],
  ["Statistics", "statistics"],
  ["Settings", "settings"],
])("a click on %s goes to its page and closes the menu", (name, page) => {
  const onNavigate = renderHeader();
  fireEvent.click(menuButton());

  fireEvent.click(link(name));

  expect(onNavigate).toHaveBeenCalledWith(page);
  expectMenuOpen(false);
});

it("the brand goes Home and closes the menu", () => {
  const onNavigate = renderHeader({ page: "statistics" });
  fireEvent.click(menuButton());

  fireEvent.click(screen.getByRole("button", { name: "Flashcards home" }));

  expect(onNavigate).toHaveBeenCalledWith("home");
  expectMenuOpen(false);
});

it("names the brand, menu button and navigation in German", () => {
  render(
    <LanguageContext.Provider value="de">
      <Header page="home" onNavigate={vi.fn()} sessionDisabled={false} />
    </LanguageContext.Provider>,
  );

  expect(screen.getByRole("button", { name: "Flashcards-Startseite" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Navigation öffnen" })).toBeTruthy();
  const names = within(screen.getByRole("navigation", { name: "Seiten" }))
    .getAllByRole("button")
    .map((button) => button.textContent);
  expect(names).toEqual(["Start", "Karten", "Sitzung", "Statistik", "Einstellungen"]);
});
