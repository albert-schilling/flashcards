// Shows a Card in a Session and reads what it shows: reveal, options, numeric answer, feedback icons.
import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Check, CircleCheck, CircleX, X, type LucideIcon } from "lucide-react";
import { expect } from "vitest";
import { App } from "../App";
import { startSession, uploaded } from "./app.helpers";
import { pickLanguage } from "./settings.helpers";

/** Uploads the Card, starts a Session in this language and returns its study card. */
export async function studyCard(card: TCard, language = "en") {
  render(<App />);
  await uploaded(card);
  pickLanguage(language);
  startSession();
  return screen.findByRole("article");
}

export function reveal(article: HTMLElement) {
  fireEvent.click(within(article).getByRole("button", { name: /^(Reveal|Aufdecken)$/ }));
}

export function clickOption(article: HTMLElement, name: string) {
  fireEvent.click(within(article).getByRole("button", { name }));
}

export function checkNumber(article: HTMLElement, value: string) {
  fireEvent.change(within(article).getByRole("spinbutton"), { target: { value } });
  fireEvent.click(within(article).getByRole("button", { name: "Check" }));
}

/** Whether the first icon in this element is this one, whatever its size. */
export function showsIcon(element: Element | null, Icon: LucideIcon) {
  const { container, unmount } = render(<Icon />);
  const shapes = container.querySelector("svg")!.innerHTML;
  unmount();
  return element?.querySelector("svg")?.innerHTML === shapes;
}

/** Each option's mark: its letter, or "correct check" or "incorrect x" once answered. */
export function optionMarks(article: HTMLElement) {
  return [...article.querySelectorAll(".option-button")].map((option) => {
    const marker = option.querySelector(".option-marker");
    const status = ["correct", "incorrect"].find((name) => option.classList.contains(name));
    const shown = showsIcon(marker, Check)
      ? "check"
      : showsIcon(marker, X)
        ? "x"
        : marker?.textContent;
    return status ? `${status} ${shown}` : shown;
  });
}

/** Checks the feedback shows the word and its own hidden icon, and returns it. */
export function expectFeedback(article: HTMLElement, word: string, right: boolean) {
  const feedback = within(article).getByRole("status");
  expect(feedback.classList.contains(right ? "right" : "wrong")).toBe(true);
  expect(feedback.querySelector("strong")?.textContent).toBe(word);
  expect(feedback.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(showsIcon(feedback, right ? CircleCheck : CircleX)).toBe(true);
  return feedback;
}
