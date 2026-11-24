// Usage: pnpm screenshot <flow> <folder> [width]. Writes <folder>/<flow>-<shot>.png; width defaults to 1280, use 375 for mobile.
// pnpm runs the script from the repo root, so a relative <folder> is taken from there.
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { build, preview } from "vite";
import { uiText, type TUiText } from "./src/ui.text.ts";

const root = import.meta.dirname;
const exampleDeck = resolve(root, "../../libs/cards/example-deck.json");

// A flow drives the app from an empty browser, as the Learner would, and calls shot() once per PNG.
type TFlow = (page: Page, shot: (name: string) => Promise<void>) => Promise<void>;

// Uploads libs/cards/example-deck.json on the Cards page, waits for the upload summary and returns to the start page, where the caller started.
// Names are matched with `exact`, because Playwright matches substrings and "Gewusst" is inside "Nicht gewusst".
async function uploadExampleDeck(page: Page, text: TUiText = uiText.en): Promise<void> {
  await goTo(page, text.cards, text);
  await page.getByLabel(text.uploadDeck, { exact: true }).setInputFiles(exampleDeck);
  await page.getByText(text.deckSummary(6, 0, 0), { exact: true }).waitFor();
  await goTo(page, text.home, text);
}

// A missing font file falls back silently to system-ui, so a flow fails instead of shooting the wrong font.
async function requireInter(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  if (!(await page.evaluate(() => document.fonts.check("1em Inter")))) {
    throw new Error("Inter did not load");
  }
}

// A Session loads the Review log before its first Card, which is the study card, an article.
async function waitForFirstCard(page: Page, text: TUiText): Promise<void> {
  await page
    .getByRole("button", { name: text.startSession, exact: true })
    .waitFor({ state: "detached" });
  await page.locator("article button").first().waitFor();
}

// Answers every Card, Reveal Cards as known. By default: a right multiple_choice (second option), a wrong true_false (False), a right numeric (5.01).
// With `mirrored`, the other way round: a wrong multiple_choice (first option), a right true_false (True), a wrong numeric (9); the wrong multiple_choice and numeric come back once, are then answered right, and their shots end in -2.
async function answerEveryCard(
  page: Page,
  shot: (name: string) => Promise<void>,
  text: TUiText = uiText.en,
  mirrored = false,
): Promise<void> {
  await uploadExampleDeck(page, text);
  await page.getByLabel(text.cards, { exact: true }).fill("6");
  await page.getByRole("button", { name: text.startSession, exact: true }).click();
  await waitForFirstCard(page, text);
  const done = page.getByRole("button", { name: text.done, exact: true });
  const reveal = page.getByRole("button", { name: text.reveal, exact: true });
  const check = page.getByRole("button", { name: text.check, exact: true });
  const trueFalsePick = page.getByRole("button", {
    name: mirrored ? text.true : text.false,
    exact: true,
  });
  const options = page.locator("article .option-button");
  // Reviews so far per Card type, because a wrong answer comes back.
  const reviews = { choice: 0, numeric: 0 };
  // Sessions are shuffled, so Reveal Cards (qa, formula, cloze) are numbered, not named by type.
  let revealed = 0;
  // A wrong true_false comes back once, so it is numbered too.
  let trueFalse = 0;
  while (!(await done.isVisible())) {
    if (await reveal.isVisible()) {
      revealed++;
      await shot(`reveal-${revealed}-before`);
      await reveal.click();
      await shot(`reveal-${revealed}-after`);
      await page.getByRole("button", { name: text.knewIt, exact: true }).click();
    } else if (await trueFalsePick.isVisible()) {
      trueFalse++;
      await shot(`true-false-${trueFalse}-before`);
      await trueFalsePick.click();
      await shot(`true-false-${trueFalse}-after`);
      await page.getByRole("button", { name: text.next, exact: true }).click();
    } else if (await check.isVisible()) {
      const again = ++reviews.numeric > 1 ? `-${reviews.numeric}` : "";
      await shot(`numeric-before${again}`);
      // 5.01 is on the edge of the allowed error, so right; 9 is wrong.
      const typed = mirrored && !again ? "9" : "5.01";
      await page.getByLabel(text.answer, { exact: true }).fill(typed);
      await check.click();
      await shot(`numeric-after${again}`);
      await page.getByRole("button", { name: text.next, exact: true }).click();
    } else if ((await options.count()) > 0) {
      const again = ++reviews.choice > 1 ? `-${reviews.choice}` : "";
      await shot(`multiple-choice-before${again}`);
      await options.nth(mirrored && !again ? 0 : 1).click();
      await shot(`multiple-choice-after${again}`);
      await page.getByRole("button", { name: text.next, exact: true }).click();
    } else {
      // Each pass answers one Card, so an unknown view would loop forever.
      throw new Error("answer flow: no Card view it knows is shown");
    }
  }
  await shot("summary");
}

// From the start page, opens Statistics and waits for its Cards table. Looks inside main, because the navigation has a Statistics button too.
async function openStatistics(page: Page, text: TUiText): Promise<void> {
  await page.getByRole("main").getByRole("button", { name: text.statistics, exact: true }).click();
  await page.getByRole("table", { name: text.cards, exact: true }).waitFor();
}

// Fails when an overview figure is wider than its box, when the page scrolls sideways, or when a table wider than its panel can't scroll inside it; throws when it finds no figure or table. A scrollable table is left scrolled to its end. jsdom does no layout, so the browser checks it.
async function checkStatisticsFits(page: Page, flow: string): Promise<void> {
  const found = await page.evaluate(() => {
    const figures = Array.from(document.querySelectorAll(".stat-overview div"));
    const tables = Array.from(document.querySelectorAll(".table-scroll"));
    return {
      figures: figures.length,
      tables: tables.length,
      overflowing: figures.filter((figure) => figure.scrollWidth > figure.clientWidth).length,
      pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      stuck: tables.filter((table) => {
        if (table.scrollWidth <= table.clientWidth) return false;
        table.scrollLeft = table.scrollWidth;
        return table.scrollLeft === 0;
      }).length,
    };
  });
  if (found.figures === 0) throw new Error(`${flow} flow: found no overview figures`);
  if (found.tables === 0) throw new Error(`${flow} flow: found no tables`);
  if (found.overflowing > 0) {
    throw new Error(`${flow} flow: ${found.overflowing} overview figures are wider than their box`);
  }
  if (found.pageScrolls) throw new Error(`${flow} flow: the page scrolls sideways`);
  if (found.stuck > 0) {
    throw new Error(
      `${flow} flow: ${found.stuck} tables are wider than their panel and can't scroll`,
    );
  }
}

// Shows the states a plain page doesn't: disabled, hovered, keyboard-focused and rejected.
async function showControls(page: Page, shot: (name: string) => Promise<void>): Promise<void> {
  const text = uiText.en;
  await shot("empty-start-page");
  // Tab from the page start reaches the header brand first, so focus the Language select directly.
  await goTo(page, text.settings);
  await page.getByLabel(text.language).focus();
  await shot("field-focus");
  // A file that isn't a Deck is rejected and shows the danger alert in the Files panel.
  await goTo(page, text.cards);
  await page.getByLabel(text.uploadDeck, { exact: true }).setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("not json"),
  });
  await page.getByText(text.fileRejected, { exact: true }).waitFor();
  await shot("rejected-upload");
  // Start Session is disabled until there are Cards, and a disabled button shows no hover.
  await uploadExampleDeck(page);
  await page.getByRole("button", { name: text.startSession, exact: true }).hover();
  await shot("button-hover");
}

// The link to a page in the navigation; on phones it is hidden until the menu opens.
function navLink(page: Page, name: string, text: TUiText = uiText.en): Locator {
  return page
    .getByRole("navigation", { name: text.pages, exact: true })
    .getByRole("button", { name, exact: true });
}

// Goes to a page through the navigation; on phones the menu opens first, as the Learner would.
async function goTo(page: Page, name: string, text: TUiText = uiText.en): Promise<void> {
  const menu = page.getByRole("button", { name: text.openNavigation, exact: true });
  if (await menu.isVisible()) await menu.click();
  await navLink(page, name, text).click();
}

// Shows the menu, then each page the navigation reaches, Back on the Session and on Statistics, and the brand.
async function showNavigation(page: Page, shot: (name: string) => Promise<void>): Promise<void> {
  const text = uiText.en;
  await uploadExampleDeck(page);
  const menu = page.getByRole("button", { name: text.openNavigation, exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    await shot("menu-open");
    // An open menu must not stack the links once the window is wide enough for the row.
    const phone = page.viewportSize();
    await page.setViewportSize({ width: 1280, height: 720 });
    await shot("menu-open-widened");
    if (phone !== null) await page.setViewportSize(phone);
    await menu.click();
  }
  await shot("home");
  await goTo(page, text.cards);
  await page.getByRole("heading", { name: text.cards, exact: true }).waitFor();
  await shot("cards");
  // The current link keeps its colours on hover.
  if (await menu.isVisible()) await menu.click();
  await navLink(page, text.cards).hover();
  await shot("current-link-hover");
  if (await menu.isVisible()) await menu.click();
  await goTo(page, text.session);
  await waitForFirstCard(page, text);
  await shot("session");
  await page.getByRole("button", { name: text.back, exact: true }).click();
  await page.getByRole("button", { name: text.startSession, exact: true }).waitFor();
  await shot("session-back");
  // The Session link returns to the running Session.
  await goTo(page, text.session);
  await waitForFirstCard(page, text);
  await goTo(page, text.statistics);
  await page.getByRole("table", { name: text.cards, exact: true }).waitFor();
  await shot("statistics");
  await page.getByRole("button", { name: text.back, exact: true }).click();
  await page.getByRole("button", { name: text.startSession, exact: true }).waitFor();
  await shot("statistics-back");
  await goTo(page, text.settings);
  await page.getByRole("heading", { name: text.settings, exact: true }).waitFor();
  await shot("settings");
  await page.getByRole("button", { name: text.brandHome, exact: true }).click();
  await page.getByRole("button", { name: text.startSession, exact: true }).waitFor();
  await shot("brand-home");
}

// Uploads a Deck of one Card with 5 tags, the first two domain tags, starts a Session and shoots the study card collapsed and expanded.
async function showTags(page: Page, shot: (name: string) => Promise<void>, text: TUiText) {
  const deck = JSON.parse(await readFile(exampleDeck, "utf8"));
  const tags = {
    domain: ["Statistics", "Machine Learning"],
    topic: ["Regression", "Bias", "Variance"],
  };
  await goTo(page, text.cards, text);
  await page.getByLabel(text.uploadDeck, { exact: true }).setInputFiles({
    name: "tags.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ cards: [{ ...deck.cards[0], tags }] })),
  });
  await page.getByText(text.deckSummary(1, 0, 0), { exact: true }).waitFor();
  await goTo(page, text.home, text);
  await page.getByRole("button", { name: text.startSession, exact: true }).click();
  await waitForFirstCard(page, text);
  await shot("collapsed");
  await page.getByRole("button", { name: text.moreTagsName(3), exact: true }).click();
  await shot("expanded");
}

// The control of the Card editor field with this label. A field's label holds its hint and error too, so it is found by its label text, matched exactly.
function editorControl(page: Page, label: string): Locator {
  return page
    .getByRole("dialog")
    .locator("label.field")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("input, textarea, select");
}

const flows: Record<string, TFlow> = {
  tags: (page, shot) => showTags(page, shot, uiText.en),
  "tags-german": async (page, shot) => {
    await goTo(page, uiText.en.settings);
    await page.getByLabel(uiText.en.language).selectOption("de");
    await page.getByRole("heading", { name: uiText.de.settings, exact: true }).waitFor();
    await showTags(page, shot, uiText.de);
  },
  navigation: showNavigation,
  controls: showControls,
  upload: async (page, shot) => {
    const text = uiText.en;
    await uploadExampleDeck(page);
    await goTo(page, text.cards);
    await page.getByText(text.cardCountOf(6, 6), { exact: true }).waitFor();
    await shot("card-list");
    await page.getByRole("button", { name: text.downloadReviewLog, exact: true }).click();
    await page.getByText(text.daysSinceDownload(0), { exact: true }).waitFor();
    await shot("downloaded");
    await page
      .getByRole("button", { name: /^Delete (?!all)/ })
      .first()
      .click();
    await shot("delete-card-modal");
    await page.getByRole("dialog").getByRole("button", { name: text.delete, exact: true }).click();
    await page.getByText(text.cardCountOf(5, 5), { exact: true }).waitFor();
    await page.getByText(text.cardDeleted, { exact: true }).waitFor();
    await shot("deleted-one");
    const deleteAll = page.getByRole("button", { name: text.deleteAllCards });
    await deleteAll.click();
    await shot("delete-all-modal");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: text.cancel }).click();
    await dialog.waitFor({ state: "detached" });
    await deleteAll.click();
    await dialog.getByRole("button", { name: text.deleteAllCards }).click();
    await page.getByText(text.noCardsYet).waitFor();
    await shot("deleted-all");
  },
  // Searches by ID, combines Type and Tag, finds nothing, then clears all three.
  search: async (page, shot) => {
    const text = uiText.en;
    await uploadExampleDeck(page);
    await goTo(page, text.cards);
    const search = page.getByLabel(text.searchCards, { exact: true });
    await search.fill("ml.trees.depth");
    await page.getByText(text.cardCountOf(1, 6), { exact: true }).waitFor();
    await shot("id");
    await search.fill("");
    // Not exact: a select's label name includes its option names.
    await page.getByLabel(text.type).selectOption("multiple_choice");
    await page.getByLabel(text.tag).selectOption("Decision Tree");
    await page.getByText(text.cardCountOf(1, 6), { exact: true }).waitFor();
    await shot("type-and-tag");
    await search.fill("zzz");
    await page.getByText(text.noMatchingCards, { exact: true }).waitFor();
    await shot("no-match");
    await search.fill("");
    await page.getByLabel(text.type).selectOption("");
    await page.getByLabel(text.tag).selectOption("");
    await page.getByText(text.cardCountOf(6, 6), { exact: true }).waitFor();
    await shot("cleared");
  },
  // The Cards list in German with a long title, a long ID and four tags. Fails when a row's copy is taller than its row button, which fills the row inside its padding, or when a row's Delete is not the --touch-target square, or when a Card type name in either language is wider than the Type select's room for text; jsdom does no layout, so the browser checks it.
  "cards-german": async (page, shot) => {
    const text = uiText.de;
    await goTo(page, uiText.en.settings);
    await page.getByLabel(uiText.en.language).selectOption("de");
    await page.getByRole("heading", { name: text.settings, exact: true }).waitFor();
    const deck = JSON.parse(await readFile(exampleDeck, "utf8"));
    const long = {
      ...deck.cards[0],
      id: "machine-learning.decision-trees.regression.leaf-mean-prediction",
      tags: {
        domain: ["Machine Learning", "Statistik"],
        topic: ["Entscheidungsbaum", "Regressionsblatt"],
      },
      translations: {
        de: {
          question:
            "Was sagt ein Regressionsblatt eines Entscheidungsbaums für eine neue Stichprobe mit mehreren Merkmalen genau vorher?",
          answer: "Den Mittelwert seiner Stichproben.",
        },
      },
    };
    await goTo(page, text.cards, text);
    await page.getByLabel(text.uploadDeck, { exact: true }).setInputFiles({
      name: "long.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ cards: [long, ...deck.cards.slice(1)] })),
    });
    await page.getByText(text.deckSummary(6, 0, 0), { exact: true }).waitFor();
    await page.getByText(text.cardCountOf(6, 6), { exact: true }).waitFor();
    const tooTall = await page.locator(".library-card-row").evaluateAll(
      (rows) =>
        rows.filter((row) => {
          const copy = row.querySelector(".library-card-copy")!.getBoundingClientRect().height;
          return copy > row.querySelector(".library-card-open")!.getBoundingClientRect().height;
        }).length,
    );
    if (tooTall > 0)
      throw new Error(`cards-german flow: ${tooTall} row buttons are shorter than their copy`);
    const deletes = await page
      .locator(".library-card-row > button:last-child")
      .evaluateAll((buttons) => {
        const root = getComputedStyle(document.documentElement);
        const target =
          parseFloat(root.getPropertyValue("--touch-target")) * parseFloat(root.fontSize);
        return {
          count: buttons.length,
          notSquare: buttons.filter((button) => {
            const box = button.getBoundingClientRect();
            return Math.abs(box.width - target) > 1 || Math.abs(box.height - target) > 1;
          }).length,
        };
      });
    if (deletes.count === 0) throw new Error("cards-german flow: found no row Delete buttons");
    if (deletes.notSquare > 0)
      throw new Error(
        `cards-german flow: ${deletes.notSquare} row Deletes are not a touch-target square`,
      );
    const select = page.getByLabel(text.type);
    const names = [...Object.values(uiText.en.cardTypes), ...Object.values(text.cardTypes)];
    const tooWide = await select.evaluate((element, labels) => {
      const style = getComputedStyle(element);
      const context = document.createElement("canvas").getContext("2d");
      if (context === null) throw new Error("no canvas context");
      context.font = style.font;
      const room =
        element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return labels.filter((label) => context.measureText(label).width > room);
    }, names);
    if (tooWide.length > 0) {
      throw new Error(`cards-german flow: the Type select clips ${tooWide.join(", ")}`);
    }
    await shot("list");
    const firstRow = page.locator(".library-card-row").first();
    await firstRow.locator(".library-card-open").focus();
    await page.keyboard.press("Tab");
    await shot("delete-focus");
    const deleteButton = firstRow.locator("> button:last-child");
    await deleteButton.blur();
    await deleteButton.hover();
    await shot("delete-hover");
    await select.selectOption("true_false");
    await page.getByText(text.cardCountOf(1, 6), { exact: true }).waitFor();
    await shot("type-select");
  },
  // Opens each Card of the example Deck in its preview, then deletes the last one from its preview.
  preview: async (page, shot) => {
    const text = uiText.en;
    await uploadExampleDeck(page);
    await goTo(page, text.cards);
    await page.getByText(text.cardCountOf(6, 6), { exact: true }).waitFor();
    const rows = page.getByRole("listitem");
    const dialog = page.getByRole("dialog", { name: text.cardPreview, exact: true });
    for (let i = 0; i < 6; i++) {
      await rows.nth(i).locator(".library-card-open").click();
      const label = await dialog.locator(".type-label").textContent();
      const type = Object.entries(text.cardTypes).find(([, name]) => name === label)?.[0];
      if (type === undefined) throw new Error(`preview flow: no Card type is named ${label}`);
      await shot(type.replaceAll("_", "-"));
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
    }
    await rows.nth(5).locator(".library-card-open").click();
    await dialog.getByRole("button", { name: text.delete, exact: true }).click();
    await page.getByText(text.cardCountOf(5, 5), { exact: true }).waitFor();
    await page.getByText(text.cardDeleted, { exact: true }).waitFor();
    await shot("deleted");
  },
  // Uploads 1,000 Cards, checks that only a few rows are in the DOM, then shoots the top, the middle, Tab through rows and the end.
  windowed: async (page, shot) => {
    const text = uiText.en;
    const deck = JSON.parse(await readFile(exampleDeck, "utf8"));
    const cards = Array.from({ length: 1000 }, (_, i) => ({
      ...deck.cards[0],
      // Padded, because the Cards are listed in the order of their IDs as text.
      id: `bulk.card-${String(i + 1).padStart(4, "0")}`,
    }));
    await goTo(page, text.cards, text);
    await page.getByLabel(text.uploadDeck, { exact: true }).setInputFiles({
      name: "bulk.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ cards })),
    });
    await page.getByText(text.cardCountOf(1000, 1000), { exact: true }).waitFor();
    await shot("top");
    const rows = page.getByRole("listitem");
    if ((await rows.count()) > 12) throw new Error("windowed flow: too many rows in the DOM");
    const box = page.locator(".virtual-list");
    await box.evaluate((element) => {
      element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
    });
    await rows.nth(4).waitFor();
    await shot("middle");
    // Each row has two buttons, so 16 Tab presses move focus 8 rows on.
    const first = rows.nth(4).locator(".library-card-open");
    await first.focus();
    const startId = await rows.nth(4).getAttribute("data-card-id");
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press("Tab");
      // The browser scrolls the focused button into view and the list renders the next rows a frame later.
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))));
    }
    const focusedId = await page.evaluate(
      () => document.activeElement?.closest("li")?.getAttribute("data-card-id") ?? null,
    );
    const place = (id: string | null) => Number(id?.replace("bulk.card-", ""));
    if (place(focusedId) !== place(startId) + 8) {
      throw new Error(`windowed flow: Tab went from ${startId} to ${focusedId}, not 8 rows on`);
    }
    // Focus also scrolled the page; a full-page shot would paint the sticky header over the list.
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot("focus");
    await box.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.getByText("bulk.card-1000", { exact: true }).waitFor();
    await shot("end");
  },
  answer: answerEveryCard,
  // The answer flow with the right and wrong answers swapped, so every Card type shows both.
  "answer-wrong": async (page, shot) => answerEveryCard(page, shot, uiText.en, true),
  // Picks Deutsch on Settings, answers every Card, then shows the start page and Statistics; Cards without a German field show it in English.
  german: async (page, shot) => {
    await goTo(page, uiText.en.settings);
    // Not exact: the label's name includes the option names.
    await page.getByLabel(uiText.en.language).selectOption("de");
    await page.getByRole("heading", { name: uiText.de.settings, exact: true }).waitFor();
    await shot("settings");
    await goTo(page, uiText.de.home, uiText.de);
    await shot("empty-start-page");
    await answerEveryCard(page, shot, uiText.de);
    await page.getByRole("button", { name: uiText.de.done, exact: true }).click();
    await page
      .getByRole("main")
      .getByRole("button", { name: uiText.de.statistics, exact: true })
      .waitFor();
    await shot("start-page");
    await openStatistics(page, uiText.de);
    await shot("statistics");
    await checkStatisticsFits(page, "german");
  },
  // Creates a cloze and a true_false Card from Home's empty state and the Cards page, shows the field errors, then edits one.
  editor: async (page, shot) => {
    const text = uiText.en;
    const dialog = page.getByRole("dialog");
    const preview = page.getByRole("dialog", { name: text.cardPreview, exact: true });
    const tags = async () => {
      await editorControl(page, text.lesson).fill("lesson-04");
      await editorControl(page, text.domainTags).fill("Machine Learning");
      await editorControl(page, text.topicTags).fill("Decision Tree, Leaf");
    };
    await page.getByRole("button", { name: text.createCard, exact: true }).click();
    await dialog.getByRole("heading", { name: text.createCard, exact: true }).waitFor();
    await shot("empty");
    await dialog.getByRole("button", { name: text.createCard, exact: true }).click();
    await page.locator(".field-error").first().waitFor();
    await shot("errors");
    await editorControl(page, text.type).selectOption("cloze");
    await editorControl(page, text.text).fill("A {{leaf}} holds the mean of its samples.");
    await tags();
    await shot("cloze-filled");
    await dialog.getByRole("button", { name: text.createCard, exact: true }).click();
    await page.getByText(text.cardSaved, { exact: true }).waitFor();
    await preview.waitFor();
    await shot("saved");
    await page.keyboard.press("Escape");
    await page
      .locator(".cards-page-heading")
      .getByRole("button", { name: text.createCard, exact: true })
      .click();
    await editorControl(page, text.type).selectOption("true_false");
    await editorControl(page, text.statement).fill("A decision tree can overfit.");
    await editorControl(page, text.answer).selectOption("true");
    await tags();
    await shot("true-false-filled");
    await dialog.getByRole("button", { name: text.createCard, exact: true }).click();
    await preview.waitFor();
    await page.keyboard.press("Escape");
    await page.getByText(text.cardCountOf(2, 2), { exact: true }).waitFor();
    await page.locator(".library-card-open").first().click();
    await preview.getByRole("button", { name: text.edit, exact: true }).click();
    await dialog.getByRole("heading", { name: text.editCard, exact: true }).waitFor();
    await shot("edit");
    await editorControl(page, text.answer).selectOption("false");
    await dialog.getByRole("button", { name: text.saveChanges, exact: true }).click();
    await preview.getByText(/version 2$/).waitFor();
    await shot("edit-saved");
  },
  // Answers every Card without shots, then opens Statistics.
  statistics: async (page, shot) => {
    await answerEveryCard(page, async () => {});
    await page.getByRole("button", { name: uiText.en.done, exact: true }).click();
    await openStatistics(page, uiText.en);
    await shot("statistics");
    await checkStatisticsFits(page, "statistics");
    await shot("scrolled");
  },
};

const [flowName, folder, widthArgument = "1280"] = process.argv.slice(2);
const width = Number(widthArgument);
const flow = flowName === undefined ? undefined : flows[flowName];
if (flowName === undefined || flow === undefined || folder === undefined || !(width > 0)) {
  console.error("Usage: pnpm screenshot <flow> <folder> [width]");
  console.error(`Flows: ${Object.keys(flows).join(", ")}`);
  process.exit(1);
}

await mkdir(folder, { recursive: true });
await build({ root, logLevel: "warn" });
const server = await preview({ root });
const browser = await chromium.launch();
try {
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) throw new Error("vite preview has no local URL");
  // The flows start in English, whatever the language of the machine.
  const page = await browser.newPage({ locale: "en-US", viewport: { width, height: 720 } });
  await page.goto(url);
  await requireInter(page);
  await flow(page, async (name) => {
    // Buttons fade between states; a shot taken mid-fade shows a colour no state has.
    await page.screenshot({
      path: resolve(folder, `${flowName}-${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
} finally {
  await browser.close();
  await server.close();
}
