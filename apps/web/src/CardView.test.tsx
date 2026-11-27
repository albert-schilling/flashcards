import { fireEvent, screen, within } from "@testing-library/react";
import { CircleCheck, CircleX } from "lucide-react";
import { expect, it } from "vitest";
import {
  cloze,
  formula,
  german,
  multipleChoice,
  numeric,
  qa,
  trueFalse,
} from "./test/cards.fixtures";
import {
  checkNumber,
  clickOption,
  expectFeedback,
  optionMarks,
  reveal,
  showsIcon,
  studyCard,
} from "./test/study.helpers";

it("a revealed formula is in the formula element, with no example when the Card has none", async () => {
  const article = await studyCard(formula("norm", 1));

  reveal(article);

  expect(article.querySelector(".revealed-answer .formula")?.textContent).toBe("norm = a · b");
  expect(article.querySelector(".example")).toBeNull();
});

it.each([
  { language: "en", shown: "Example: 2 · 3 = 6" },
  { language: "de", shown: "Beispiel: 2 · 3 = 6" },
])("a revealed formula's example reads $shown", async (c) => {
  const article = await studyCard(formula("norm", 1, "2 · 3 = 6"), c.language);

  reveal(article);

  expect(article.querySelector(".revealed-answer .example")?.textContent).toBe(c.shown);
});

it("marks every cloze word, reads as the whole sentence and keeps markup as plain text", async () => {
  const article = await studyCard(cloze("c", 1, "{{Deep}} <b>trees</b> have {{high}} variance."));

  reveal(article);

  const sentence = article.querySelector(".revealed-answer p")!;
  expect(sentence.textContent).toBe("Deep <b>trees</b> have high variance.");
  expect(Array.from(sentence.querySelectorAll("mark"), (word) => word.textContent)).toEqual([
    "Deep",
    "high",
  ]);
  expect(sentence.querySelector("b")).toBeNull();
});

it("after Reveal, Didn't know comes before Knew it, each with a hidden icon", async () => {
  const article = await studyCard(qa("q", 1));

  reveal(article);

  const buttons = within(article).getAllByRole("button");
  expect(buttons.map((button) => button.textContent)).toEqual(["Didn't know", "Knew it"]);
  const didntKnow = within(article).getByRole("button", { name: "Didn't know" });
  const knewIt = within(article).getByRole("button", { name: "Knew it" });
  expect(showsIcon(didntKnow, CircleX)).toBe(true);
  expect(showsIcon(knewIt, CircleCheck)).toBe(true);
  for (const button of buttons) {
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  }
});

it.each([
  { card: multipleChoice("mc", 1), names: ["This", "That"] },
  { card: trueFalse("tf", 1), names: ["True", "False"] },
])("$card.type options show A and B, and their names stay the option text", async (c) => {
  const article = await studyCard(c.card);

  expect(optionMarks(article)).toEqual(["A", "B"]);
  for (const name of c.names) {
    const option = within(article).getByRole("button", { name });
    expect(option.querySelector(".option-marker")?.getAttribute("aria-hidden")).toBe("true");
  }
});

it.each([
  { card: multipleChoice("mc", 1), click: "This", marks: ["correct check", "B"] },
  { card: trueFalse("tf", 1, false), click: "False", marks: ["A", "correct check"] },
])("a right pick marks only that option correct ($card.type)", async (c) => {
  const article = await studyCard(c.card);

  clickOption(article, c.click);

  expect(optionMarks(article)).toEqual(c.marks);
  expect(within(article).getByRole("button", { name: c.click })).toBeTruthy();
});

it.each([
  { card: multipleChoice("mc", 1), click: "That", marks: ["correct check", "incorrect x"] },
  { card: trueFalse("tf", 1, false), click: "True", marks: ["incorrect x", "correct check"] },
])("a wrong pick marks it incorrect and the right option correct ($card.type)", async (c) => {
  const article = await studyCard(c.card);

  clickOption(article, c.click);

  expect(optionMarks(article)).toEqual(c.marks);
});

it.each([
  { case: "the right one", pick: 0, marks: ["correct check", "B"] },
  { case: "the wrong one", pick: 1, marks: ["correct check", "incorrect x"] },
])("repeated options are marked by position, picking $case", async (c) => {
  const card = multipleChoice("mc", 1);
  const article = await studyCard({ ...card, en: { ...card.en, options: ["Same", "Same"] } });

  fireEvent.click(within(article).getAllByRole("button", { name: "Same" })[c.pick]);

  expect(optionMarks(article)).toEqual(c.marks);
});

it.each([
  { card: multipleChoice("mc", 1), click: "This", shown: "Answer: This" },
  { card: trueFalse("tf", 1), click: "True", shown: "Answer: True" },
])("right feedback is a status with an icon and the word ($card.type)", async (c) => {
  const article = await studyCard(c.card);

  clickOption(article, c.click);

  expect(expectFeedback(article, "Right.", true).textContent).toContain(c.shown);
});

it.each([
  { card: multipleChoice("mc", 1), click: "That", shown: "Answer: This" },
  { card: trueFalse("tf", 1), click: "False", shown: "Answer: True" },
])("wrong feedback is a status with an icon and the word ($card.type)", async (c) => {
  const article = await studyCard(c.card);

  clickOption(article, c.click);

  expect(expectFeedback(article, "Wrong.", false).textContent).toContain(c.shown);
});

it.each([
  { card: multipleChoice("mc", 1), act: (a: HTMLElement) => clickOption(a, "This") },
  { card: trueFalse("tf", 1), act: (a: HTMLElement) => clickOption(a, "True") },
  { card: numeric("n", 1), act: (a: HTMLElement) => checkNumber(a, "5") },
])("Next appears only after answering, after the same study card ($card.type)", async (c) => {
  const article = await studyCard(c.card);
  expect(screen.queryByRole("button", { name: "Next" })).toBeNull();

  c.act(article);

  expect(screen.getByRole("article")).toBe(article);
  const next = screen.getByRole("button", { name: "Next" });
  expect(article.contains(next)).toBe(false);
  expect(article.nextElementSibling).toBe(next);
  expect(next.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

it.each([
  { click: "Dies", word: "Richtig.", right: true },
  { click: "Das", word: "Falsch.", right: false },
])("German feedback shows $word", async (c) => {
  const card = german(multipleChoice("mc", 1), { options: ["Dies", "Das"] });
  const article = await studyCard(card, "de");

  clickOption(article, c.click);

  expectFeedback(article, c.word, c.right);
});

it("with a unit, the numeric input is named exactly Answer and the unit is shown", async () => {
  const article = await studyCard(numeric("n", 1, "cm"));

  const input = within(article).getByRole<HTMLInputElement>("spinbutton", { name: "Answer" });

  expect(input.labels?.[0]?.textContent).toBe("Answer");
  expect(article.querySelector(".input-with-unit input")).toBe(input);
  expect(article.querySelector(".input-with-unit > span")?.textContent).toBe("cm");
});

it("without a unit, the numeric answer shows no unit element", async () => {
  const article = await studyCard(numeric("n", 1));

  expect(within(article).getByRole("spinbutton", { name: "Answer" })).toBeTruthy();
  expect(article.querySelector(".input-with-unit > span")).toBeNull();
});

it.each([
  { typed: "5", word: "Right.", right: true },
  { typed: "6", word: "Wrong.", right: false },
])("numeric feedback for $typed shows $word and the answer with its unit", async (c) => {
  const article = await studyCard(numeric("n", 1, "cm"));

  checkNumber(article, c.typed);

  expect(expectFeedback(article, c.word, c.right).textContent).toContain("Answer: 5 cm");
});

it.each([qa("q", 1), formula("f", 1), cloze("c", 1)])(
  "a $type Card shows no Next, before or after Reveal",
  async (card) => {
    const article = await studyCard(card);
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();

    reveal(article);

    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  },
);

it("a revealed formula shows its German example after the German prefix", async () => {
  const card = german(formula("norm", 1, "2 · 3 = 6"), { example: "zwei mal drei" });
  const article = await studyCard(card, "de");

  reveal(article);

  expect(article.querySelector(".revealed-answer .example")?.textContent).toBe(
    "Beispiel: zwei mal drei",
  );
});

it.each([
  { case: "ending in a gap", text: "A tree has {{depth}}", words: ["depth"] },
  { case: "with adjacent gaps", text: "{{deep}}{{tree}} here.", words: ["deep", "tree"] },
])("marks the cloze words in a text $case", async (c) => {
  const article = await studyCard(cloze("c", 1, c.text));

  reveal(article);

  const sentence = article.querySelector(".revealed-answer p")!;
  expect(sentence.textContent).toBe(c.text.replaceAll(/\{\{|\}\}/g, ""));
  expect(Array.from(sentence.querySelectorAll("mark"), (word) => word.textContent)).toEqual(
    c.words,
  );
});

it("four options show A to D, and a wrong pick leaves the others' letters and names", async () => {
  const card = multipleChoice("mc", 1);
  const options = ["One", "Two", "Three", "Four"];
  const article = await studyCard({ ...card, en: { ...card.en, options } });
  expect(optionMarks(article)).toEqual(["A", "B", "C", "D"]);

  clickOption(article, "Three");

  expect(optionMarks(article)).toEqual(["correct check", "B", "incorrect x", "D"]);
  for (const name of options) {
    expect(within(article).getByRole("button", { name })).toBeTruthy();
  }
});

it.each([
  { click: "This", word: "Right.", right: true },
  { click: "That", word: "Wrong.", right: false },
])("the explanation is inside the $word feedback", async (c) => {
  const article = await studyCard(multipleChoice("mc", 1));

  clickOption(article, c.click);

  expect(within(expectFeedback(article, c.word, c.right)).getByText("This one.")).toBeTruthy();
});
