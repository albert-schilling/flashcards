// Usage: pnpm screenshot <flow> <folder> [width]. Writes <folder>/<flow>-<shot>.png; width defaults to 1280, use 375 for mobile.
// pnpm runs the script from the repo root, so a relative <folder> is taken from there.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import { build, preview } from "vite";
import { uiText, type TUiText } from "./src/ui.text.ts";

const root = import.meta.dirname;
const exampleDeck = resolve(root, "../../libs/cards/example-deck.json");

// A flow drives the app from an empty browser, as the Learner would, and calls shot() once per PNG.
type TFlow = (page: Page, shot: (name: string) => Promise<void>) => Promise<void>;

// Uploads libs/cards/example-deck.json and waits until its six Cards are listed.
// Names are matched with `exact`, because Playwright matches substrings and "Gewusst" is inside "Nicht gewusst".
async function uploadExampleDeck(page: Page, text: TUiText = uiText.en): Promise<void> {
  await page.getByLabel(text.uploadDeck, { exact: true }).setInputFiles(exampleDeck);
  await page.getByText(text.deckSummary(6, 0, 0), { exact: true }).waitFor();
}

// A missing font file falls back silently to system-ui, so a flow fails instead of shooting the wrong font.
async function requireInter(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  if (!(await page.evaluate(() => document.fonts.check("1em Inter")))) {
    throw new Error("Inter did not load");
  }
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
  // Start loads the Review log first, so wait for the first Card.
  await page.locator("section button").first().waitFor();
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

// From the start page, opens Statistics and waits for its Cards table.
async function openStatistics(page: Page, text: TUiText): Promise<void> {
  await page.getByRole("button", { name: text.statistics, exact: true }).click();
  await page.getByRole("table", { name: text.cards, exact: true }).waitFor();
}

// Shows the states a plain page doesn't: disabled, hovered, keyboard-focused and rejected.
async function showControls(page: Page, shot: (name: string) => Promise<void>): Promise<void> {
  const text = uiText.en;
  await shot("empty-start-page");
  // Tab from the page start reaches the first control, the Language select.
  await page.keyboard.press("Tab");
  await shot("field-focus");
  // A file that isn't a Deck is rejected and shows the danger alert.
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

const flows: Record<string, TFlow> = {
  controls: showControls,
  upload: async (page, shot) => {
    await uploadExampleDeck(page);
    await shot("card-list");
  },
  answer: answerEveryCard,
  // Picks Deutsch, answers every Card, then shows the start page and Statistics; Cards without a German field show it in English.
  german: async (page, shot) => {
    // Not exact: the label's name includes the option names.
    await page.getByLabel(uiText.en.language).selectOption("de");
    await answerEveryCard(page, shot, uiText.de);
    await page.getByRole("button", { name: uiText.de.done, exact: true }).click();
    await page.getByRole("button", { name: uiText.de.statistics, exact: true }).waitFor();
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
