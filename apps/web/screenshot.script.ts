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

const flows: Record<string, TFlow> = {
  upload: async (page, shot) => {
    await uploadExampleDeck(page);
    await shot("card-list");
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
  const page = await browser.newPage();
  await page.goto(server.resolvedUrls?.local[0] ?? "");
  await flow(page, async (name) => {
    await page.screenshot({ path: resolve(folder, `${flowName}-${name}.png`), fullPage: true });
  });
} finally {
  await browser.close();
  await server.close();
}
