// Usage: pnpm screenshot <flow> <folder> [width]. Writes <folder>/<flow>-<shot>.png; width defaults to 1280, use 375 for mobile.
// pnpm runs the script from the repo root, so a relative <folder> is taken from there.
import { mkdir } from "node:fs/promises";
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

// A Session loads the Review log before its first Card. Home's panel is a section too, so Start Session must go first.
async function waitForFirstCard(page: Page, text: TUiText): Promise<void> {
  await page
    .getByRole("button", { name: text.startSession, exact: true })
    .waitFor({ state: "detached" });
  await page.locator("section button").first().waitFor();
}

// Answers every Card: a right multiple_choice (second option), a wrong true_false (False), a right numeric (5.01), Reveal Cards as known.
async function answerEveryCard(
  page: Page,
  shot: (name: string) => Promise<void>,
  text: TUiText = uiText.en,
): Promise<void> {
  await uploadExampleDeck(page, text);
  await page.getByLabel(text.cards, { exact: true }).fill("6");
  await page.getByRole("button", { name: text.startSession, exact: true }).click();
  await waitForFirstCard(page, text);
  const done = page.getByRole("button", { name: text.done, exact: true });
  const reveal = page.getByRole("button", { name: text.reveal, exact: true });
  const check = page.getByRole("button", { name: text.check, exact: true });
  const wrong = page.getByRole("button", { name: text.false, exact: true });
  const options = page.locator("section button");
  // Sessions are shuffled, so Reveal Cards (qa, formula, cloze) are numbered, not named by type.
  let revealed = 0;
  // The wrong true_false comes back once, so it is numbered too.
  let trueFalse = 0;
  while (!(await done.isVisible())) {
    if (await reveal.isVisible()) {
      revealed++;
      await shot(`reveal-${revealed}-before`);
      await reveal.click();
      await shot(`reveal-${revealed}-after`);
      await page.getByRole("button", { name: text.knewIt, exact: true }).click();
    } else if (await wrong.isVisible()) {
      trueFalse++;
      await shot(`true-false-${trueFalse}-before`);
      await wrong.click();
      await shot(`true-false-${trueFalse}-after`);
      await page.getByRole("button", { name: text.next, exact: true }).click();
    } else if (await check.isVisible()) {
      await shot("numeric-before");
      // On the edge of the allowed error, so right.
      await page.getByLabel(text.answer, { exact: true }).fill("5.01");
      await check.click();
      await shot("numeric-after");
      await page.getByRole("button", { name: text.next, exact: true }).click();
    } else if ((await options.count()) > 0) {
      await shot("multiple-choice-before");
      await options.nth(1).click();
      await shot("multiple-choice-after");
      await page.getByRole("button", { name: text.next, exact: true }).click();
    } else {
      // Each pass answers one Card, so an unknown view would loop forever.
      throw new Error("answer flow: no Card view it knows is shown");
    }
  }
}

// From the start page, opens Statistics and waits for its Cards table. Looks inside main, because the navigation has a Statistics button too.
async function openStatistics(page: Page, text: TUiText): Promise<void> {
  await page.getByRole("main").getByRole("button", { name: text.statistics, exact: true }).click();
  await page.getByRole("table", { name: text.cards, exact: true }).waitFor();
}

// Shows the states a plain page doesn't: disabled, hovered, keyboard-focused and rejected.
async function showControls(page: Page, shot: (name: string) => Promise<void>): Promise<void> {
  const text = uiText.en;
  await shot("empty-start-page");
  // Tab from the page start reaches the header brand first, so focus the Language select directly.
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

// Shows the menu, then each page the navigation reaches, Back on Statistics and the brand.
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
  await goTo(page, text.statistics);
  await page.getByRole("table", { name: text.cards, exact: true }).waitFor();
  await shot("statistics");
  await page.getByRole("button", { name: text.back, exact: true }).click();
  await page.getByRole("button", { name: text.startSession, exact: true }).waitFor();
  await shot("statistics-back");
  await goTo(page, text.settings);
  await page.getByText(text.pageNotBuilt, { exact: true }).waitFor();
  await shot("settings");
  await page.getByRole("button", { name: text.brandHome, exact: true }).click();
  await page.getByRole("button", { name: text.startSession, exact: true }).waitFor();
  await shot("brand-home");
}

const flows: Record<string, TFlow> = {
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
    await page.getByText(text.cardCountOf(5, 5), { exact: true }).waitFor();
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
  answer: answerEveryCard,
  // Picks Deutsch, answers every Card, then shows the start page and Statistics; Cards without a German field show it in English.
  german: async (page, shot) => {
    // Not exact: the label's name includes the option names.
    await page.getByLabel(uiText.en.language).selectOption("de");
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
  },
  // Answers every Card without shots, then opens Statistics.
  statistics: async (page, shot) => {
    await answerEveryCard(page, async () => {});
    await page.getByRole("button", { name: uiText.en.done, exact: true }).click();
    await openStatistics(page, uiText.en);
    await shot("statistics");
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
