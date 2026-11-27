// Drives the whole App: navigation, Deck upload and download, Sessions and deleting Cards; reads its headings and alert icons.
import type { TCard } from "@flashcards/cards";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, vi } from "vitest";
import { Alert, type TAlertTone } from "../Alert";

export function upload(...cards: TCard[]) {
  pick(
    new File([JSON.stringify({ cards })], "deck.json", { type: "application/json" }),
    "Upload Deck",
  );
}

/** Opens the Cards page, where the Files panel is, and picks the file in the input with this label. */
export function pick(file: File, label: string) {
  openCards();
  const input = screen.getByLabelText<HTMLInputElement>(label);
  // jsdom can't pick a file, so act like a browser: the value names the file until set to "".
  let files = [file];
  Object.defineProperty(input, "files", { configurable: true, get: () => files });
  Object.defineProperty(input, "value", {
    configurable: true,
    get: () => (files.length ? `C:\\fakepath\\${files[0].name}` : ""),
    set: (value: string) => {
      if (value === "") files = [];
    },
  });
  fireEvent.change(input);
}

// The test setup gives each test a fresh IndexedDB, so this lasts one test.
export function blockStorage() {
  globalThis.indexedDB = {
    open() {
      throw new DOMException("Storage is blocked.", "SecurityError");
    },
  } as unknown as IDBFactory;
}

export function openCards() {
  goTo(/^(Cards|Karten)$/);
}

export function goHome() {
  goTo(/^(Home|Start)$/);
}

/** Opens the Cards page and waits for the Card's row; the row shows its ID. */
export async function expectListed(card: TCard) {
  openCards();
  await screen.findByText(card.id);
}

export function levelOneHeadings() {
  return screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent);
}

// The markup of the icon an Alert of this tone shows.
export function alertIcon(tone: TAlertTone): string {
  const { container, unmount } = render(<Alert tone={tone}>Message</Alert>);
  const icon = container.querySelector("svg")!.outerHTML;
  unmount();
  return icon;
}

export async function expectNotListed(card: TCard) {
  openCards();
  await waitFor(() => expect(screen.queryByText(card.id)).toBeNull());
}

/** On the Cards page, presses this Card's row Delete, then Delete in the modal that asks first. */
export function deleteFromRow(id: string) {
  fireEvent.click(screen.getByRole("button", { name: `Delete ${id}` }));
  const modal = within(screen.getByRole("dialog", { name: "Delete this Card?" }));
  fireEvent.click(modal.getByRole("button", { name: "Delete" }));
}

export function deleteAllButton() {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: /^(Delete all Cards|Alle Karten löschen)$/,
  });
}

/** Opens the Cards page, then the Delete all Cards modal, and returns queries inside the modal. */
export function openDeleteAll() {
  openCards();
  fireEvent.click(deleteAllButton());
  return within(screen.getByRole("dialog"));
}

export async function expectNoDialog() {
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

/** Uploads the Cards on the Cards page, waits for the upload report, then goes back Home. Not the last row: the windowed list shows only the rows in view. */
export async function uploaded(...cards: TCard[]) {
  upload(...cards);
  await screen.findByText(new RegExp(`^${cards.length} added, `));
  goHome();
}

export function startButton() {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: /^(Start Session|Sitzung starten)$/,
  });
}

export function startSession() {
  fireEvent.click(startButton());
}

export async function answer(knew = true) {
  fireEvent.click(await screen.findByRole("button", { name: "Reveal" }));
  fireEvent.click(screen.getByRole("button", { name: knew ? "Knew it" : "Didn't know" }));
}

/** Opens the Cards page, where the Files panel is, clicks the button and returns the file it downloads. jsdom can't download, so this fakes the browser's part. */
export async function download(button: string): Promise<File> {
  openCards();
  const blobs = new Map<string, Blob>();
  const create = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = `blob:download-${blobs.size}`;
    blobs.set(url, blob as Blob);
    return url;
  });
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    fireEvent.click(screen.getByRole("button", { name: button }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    const url = link.getAttribute("href")!;
    await waitFor(() => expect(revoke).toHaveBeenCalledWith(url));
    return new File([blobs.get(url)!], link.download, { type: "application/json" });
  } finally {
    click.mockRestore();
    create.mockRestore();
    revoke.mockRestore();
  }
}

export function navLink(name: string | RegExp) {
  return within(
    screen.getByRole("navigation", { name: /^(Pages|Seiten)$/ }),
  ).getByRole<HTMLButtonElement>("button", { name });
}

export function goTo(name: string | RegExp) {
  fireEvent.click(navLink(name));
}

export function isCurrent(name: string) {
  return navLink(name).getAttribute("aria-current") === "page";
}
