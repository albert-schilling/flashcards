// Usage: pnpm screenshot <flow> <folder>. Writes <folder>/<flow>-<shot>.png.
// pnpm runs the script from the repo root, so a relative <folder> is taken from there.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import { build, preview } from "vite";

const root = import.meta.dirname;
const exampleDeck = resolve(root, "../../libs/cards/example-deck.json");

// A flow drives the app from an empty browser, as the Learner would, and calls shot() once per PNG.
type TFlow = (page: Page, shot: (name: string) => Promise<void>) => Promise<void>;

// Uploads libs/cards/example-deck.json and waits until its six Cards are listed.
async function uploadExampleDeck(page: Page): Promise<void> {
  await page.getByLabel("Upload Deck").setInputFiles(exampleDeck);
  await page.getByText("6 added, 0 updated, 0 unchanged").waitFor();
}

// Answers every Card: a right multiple_choice (second option), a wrong true_false (False), a right numeric (5.01), Reveal Cards as known.
async function answerEveryCard(page: Page, shot: (name: string) => Promise<void>): Promise<void> {
  await uploadExampleDeck(page);
  await page.getByLabel("Cards").fill("6");
  await page.getByRole("button", { name: "Start Session" }).click();
  // Start loads the Review log first, so wait for the first Card.
  await page.locator("section button").first().waitFor();
  const done = page.getByRole("button", { name: "Done" });
  const reveal = page.getByRole("button", { name: "Reveal" });
  const check = page.getByRole("button", { name: "Check" });
  const wrong = page.getByRole("button", { name: "False" });
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
      await page.getByRole("button", { name: "Knew it" }).click();
    } else if (await wrong.isVisible()) {
      trueFalse++;
      await shot(`true-false-${trueFalse}-before`);
      await wrong.click();
      await shot(`true-false-${trueFalse}-after`);
      await page.getByRole("button", { name: "Next" }).click();
    } else if (await check.isVisible()) {
      await shot("numeric-before");
      // On the edge of the allowed error, so right.
      await page.getByLabel("Answer").fill("5.01");
      await check.click();
      await shot("numeric-after");
      await page.getByRole("button", { name: "Next" }).click();
    } else if ((await options.count()) > 0) {
      await shot("multiple-choice-before");
      await options.nth(1).click();
      await shot("multiple-choice-after");
      await page.getByRole("button", { name: "Next" }).click();
    } else {
      // Each pass answers one Card, so an unknown view would loop forever.
      throw new Error("answer flow: no Card view it knows is shown");
    }
  }
}

const flows: Record<string, TFlow> = {
  upload: async (page, shot) => {
    await uploadExampleDeck(page);
    await shot("card-list");
  },
  answer: answerEveryCard,
  // Answers every Card without shots, then opens Statistics.
  statistics: async (page, shot) => {
    await answerEveryCard(page, async () => {});
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "Statistics" }).click();
    await page.getByRole("table", { name: "Cards" }).waitFor();
    await shot("statistics");
  },
};

const [flowName, folder] = process.argv.slice(2);
const flow = flowName === undefined ? undefined : flows[flowName];
if (flowName === undefined || flow === undefined || folder === undefined) {
  console.error("Usage: pnpm screenshot <flow> <folder>");
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
  const page = await browser.newPage();
  await page.goto(url);
  await flow(page, async (name) => {
    await page.screenshot({ path: resolve(folder, `${flowName}-${name}.png`), fullPage: true });
  });
} finally {
  await browser.close();
  await server.close();
}
