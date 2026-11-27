import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "./App";
import { answer, startSession, uploaded } from "./test/app.helpers";
import {
  cloze,
  formula,
  multipleChoice,
  numeric,
  qa,
  tagged,
  trueFalse,
} from "./test/cards.fixtures";
import { checkNumber, clickOption, reveal, studyCard } from "./test/study.helpers";

const cardTypes = [
  { card: qa("q", 1), en: "Question & answer", de: "Frage & Antwort", prompt: "What is q?" },
  {
    card: formula("f", 1),
    en: "Formula",
    de: "Formel",
    prompt: "The f formula",
    detail: "f is a times b.",
  },
  { card: cloze("c", 1), en: "Fill the gap", de: "Lückentext", prompt: "c has a ____." },
  {
    card: multipleChoice("mc", 1),
    en: "Multiple choice",
    de: "Multiple Choice",
    prompt: "Which is mc?",
  },
  { card: trueFalse("tf", 1), en: "True or false", de: "Wahr oder falsch", prompt: "tf is true." },
  { card: numeric("n", 1), en: "Numeric", de: "Numerisch", prompt: "How much is n?" },
];

it.each(cardTypes)("a $card.type Card shows its type name and strip", async (c) => {
  const article = await studyCard(c.card);

  expect(within(article).getByText(c.en)).toBeTruthy();
  expect(article.classList.contains("study-card")).toBe(true);
  expect(article.classList.contains(`type-${c.card.type}`)).toBe(true);
});

it.each(cardTypes)("a $card.type Card shows its type name in German", async (c) => {
  const article = await studyCard(c.card, "de");

  expect(within(article).getByText(c.de)).toBeTruthy();
});

// Domain tags first: the first 2 are the domain tags of `withFiveTags`.
const fiveTags = ["Statistics", "Machine Learning", "Regression", "Bias", "Variance"];

function withFiveTags<T extends TCard>(card: T): T {
  return tagged(card, fiveTags.slice(0, 2), fiveTags.slice(2));
}

function tagList(article: HTMLElement) {
  return within(article).getByRole("list", { name: "Tags" });
}

/** The tags the study card shows, in order. */
function shownTags(article: HTMLElement) {
  return within(tagList(article))
    .getAllByRole("listitem")
    .map((tag) => tag.textContent);
}

function moreTags(article: HTMLElement, name = "+3 more tags") {
  return within(article).getByRole("button", { name });
}

it.each([
  {
    language: "en",
    domain: ["Statistics"],
    topic: ["Regression", "Bias", "Variance", "Noise"],
    first: ["Statistics", "Regression"],
    shown: "+3 more",
    name: "+3 more tags",
  },
  {
    language: "de",
    domain: ["Statistics", "Machine Learning"],
    topic: ["Regression", "Bias", "Variance"],
    first: ["Statistics", "Machine Learning"],
    shown: "+3 weitere",
    name: "+3 weitere Tags",
  },
  {
    language: "en",
    domain: ["Statistics", "Machine Learning"],
    topic: ["Regression"],
    first: ["Statistics", "Machine Learning"],
    shown: "+1 more",
    name: "+1 more tag",
  },
  {
    language: "de",
    domain: ["Statistics"],
    topic: ["Regression", "Bias"],
    first: ["Statistics", "Regression"],
    shown: "+1 weiteres",
    name: "+1 weiteres Tag",
  },
])(
  "the study card shows the first 2 tags, domain first, and $shown ($language, $domain.length domain)",
  async (c) => {
    const article = await studyCard(tagged(qa("q", 1), c.domain, c.topic), c.language);

    expect(shownTags(article)).toEqual(c.first);
    const button = moreTags(article, c.name);
    expect(button.textContent).toBe(c.shown);
    expect(tagList(article).contains(button)).toBe(false);
  },
);

it.each([
  { language: "en", buttons: ["Reveal"] },
  { language: "de", buttons: ["Aufdecken"] },
])("a Card with 2 tags shows both and no more button ($language)", async (c) => {
  const article = await studyCard(tagged(qa("q", 1), ["Statistics"], ["Regression"]), c.language);

  expect(shownTags(article)).toEqual(["Statistics", "Regression"]);
  const buttons = within(article).getAllByRole("button");
  expect(buttons.map((button) => button.textContent)).toEqual(c.buttons);
});

it.each([
  { language: "en", name: "+3 more tags" },
  { language: "de", name: "+3 weitere Tags" },
])("a click on $name shows all tags and moves focus to the tag list", async (c) => {
  const article = await studyCard(withFiveTags(qa("q", 1)), c.language);
  expect(document.activeElement).not.toBe(tagList(article));

  fireEvent.click(moreTags(article, c.name));

  expect(shownTags(article)).toEqual(fiveTags);
  expect(within(article).queryByRole("button", { name: c.name })).toBeNull();
  expect(document.activeElement).toBe(tagList(article));
});

it.each([
  { card: qa("q", 1), act: reveal },
  { card: multipleChoice("mc", 1), act: (a: HTMLElement) => clickOption(a, "This") },
  { card: numeric("n", 1), act: (a: HTMLElement) => checkNumber(a, "5") },
])("expanded tags stay expanded through Reveal or answering ($card.type)", async (c) => {
  const article = await studyCard(withFiveTags(c.card));
  fireEvent.click(moreTags(article));

  c.act(article);

  expect(screen.getByRole("article")).toBe(article);
  expect(shownTags(article)).toEqual(fiveTags);
  expect(within(article).queryByRole("button", { name: "+3 more tags" })).toBeNull();
});

it("the next Card starts with its tags collapsed", async () => {
  render(<App />);
  await uploaded(withFiveTags(qa("a", 1)), withFiveTags(qa("b", 1)));
  startSession();
  fireEvent.click(moreTags(await screen.findByRole("article")));

  await answer();

  await screen.findByText("2 / 2");
  const next = screen.getByRole("article");
  expect(shownTags(next)).toEqual(fiveTags.slice(0, 2));
  expect(moreTags(next).textContent).toBe("+3 more");
});

it("a wrong Card coming back starts with its tags collapsed", async () => {
  const article = await studyCard(withFiveTags(qa("q", 1)));
  fireEvent.click(moreTags(article));

  await answer(false);

  await screen.findByText("2 / 2");
  const back = screen.getByRole("article");
  expect(shownTags(back)).toEqual(fiveTags.slice(0, 2));
  expect(moreTags(back).textContent).toBe("+3 more");
});

it("domain tags and topic tags each have their own style", async () => {
  const article = await studyCard(withFiveTags(qa("q", 1)));
  fireEvent.click(moreTags(article));

  const styled = (style: string) =>
    Array.from(tagList(article).querySelectorAll(`.card-tag.${style}`), (tag) => tag.textContent);
  expect(styled("tag-domain")).toEqual(fiveTags.slice(0, 2));
  expect(styled("tag-topic")).toEqual(fiveTags.slice(2));
});

it("a tag repeated within and across domain and topic shows each time, in its style", async () => {
  const error = vi.spyOn(console, "error");
  const article = await studyCard(tagged(qa("q", 1), ["Bias", "Bias"], ["Bias", "Variance"]));
  fireEvent.click(moreTags(article, "+2 more tags"));
  const logged = error.mock.calls.flat().join(" ");
  error.mockRestore();

  expect(shownTags(article)).toEqual(["Bias", "Bias", "Bias", "Variance"]);
  expect(tagList(article).querySelector(".tag-domain")?.textContent).toBe("Bias");
  expect(tagList(article).querySelector(".tag-topic")?.textContent).toBe("Bias");
  expect(logged).toBe("");
});

it.each(cardTypes)("a $card.type Card's prompt is a level 2 heading", async (c) => {
  const article = await studyCard(c.card);

  const heading = within(article).getByRole("heading", { level: 2, name: c.prompt });
  // Only a formula has a line below its prompt: the word formula.
  expect(heading.nextElementSibling?.textContent).toBe(c.detail);
});

it.each([qa("q", 1), formula("f", 1), cloze("c", 1)])(
  "a $type Card shows the Answer label only after Reveal, in the same study card",
  async (card) => {
    const article = await studyCard(card);
    expect(within(article).queryByText("Answer")).toBeNull();

    reveal(article);

    expect(article.querySelector(".revealed-answer .answer-label")?.textContent).toBe("Answer");
    expect(screen.getByRole("article")).toBe(article);
  },
);
