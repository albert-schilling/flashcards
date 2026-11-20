import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TUploadReport } from "./deck";
import { FilesPanel } from "./FilesPanel";
import { LanguageContext, type TLanguage } from "./language.context";
import type { TReviewLogReport } from "./review.log";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-20T10:00:00.000Z");

beforeEach(() => {
  // Fake only the clock, so the days since the last download don't depend on when the test runs.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Renders the Files panel with this report and last download in this language and returns its callback mocks and unmount. */
function renderFilesPanel(
  props: { report?: TUploadReport | TReviewLogReport; lastDownload?: string } = {},
  language: TLanguage = "en",
) {
  const callbacks = {
    onUploadDeck: vi.fn(),
    onUploadReviewLog: vi.fn(),
    onDownloadCards: vi.fn(),
    onDownloadReviewLog: vi.fn(),
  };
  const { unmount } = render(
    <LanguageContext.Provider value={language}>
      <FilesPanel {...props} {...callbacks} />
    </LanguageContext.Provider>,
  );
  return { ...callbacks, unmount };
}

/** The last download this long before now, as App stores it. */
function downloadedAgo(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

function backupNote(text: string | RegExp): HTMLElement {
  return screen.getByText(text).closest<HTMLElement>(".backup-note")!;
}

function alertOf(text: string | RegExp): HTMLElement {
  return screen.getByText(text).closest<HTMLElement>(".alert")!;
}

it("shows the Backup eyebrow, the Files heading, both uploads and both downloads", () => {
  renderFilesPanel();

  expect(screen.getByText("Backup")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 2, name: "Files" })).toBeTruthy();
  expect(screen.getByLabelText<HTMLInputElement>("Upload Deck").type).toBe("file");
  expect(screen.getByLabelText<HTMLInputElement>("Upload Review log").type).toBe("file");
  expect(screen.getByRole("button", { name: "Download Cards" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download Review log" })).toBeTruthy();
});

it("shows the Files panel in German", () => {
  renderFilesPanel({}, "de");

  expect(screen.getByText("Sicherung")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 2, name: "Dateien" })).toBeTruthy();
  expect(screen.getByLabelText("Deck hochladen")).toBeTruthy();
  expect(screen.getByLabelText("Lernprotokoll hochladen")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Karten herunterladen" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Lernprotokoll herunterladen" })).toBeTruthy();
  expect(screen.getByText("Noch nichts heruntergeladen")).toBeTruthy();
});

it("Upload Deck and Upload Review log each pass the picked file's change to their own callback", () => {
  const callbacks = renderFilesPanel();
  const deck = screen.getByLabelText("Upload Deck");
  const reviewLog = screen.getByLabelText("Upload Review log");

  fireEvent.change(deck);
  expect(callbacks.onUploadDeck).toHaveBeenCalledOnce();
  expect(callbacks.onUploadDeck.mock.calls[0][0].target).toBe(deck);
  expect(callbacks.onUploadReviewLog).not.toHaveBeenCalled();

  fireEvent.change(reviewLog);
  expect(callbacks.onUploadReviewLog).toHaveBeenCalledOnce();
  expect(callbacks.onUploadReviewLog.mock.calls[0][0].target).toBe(reviewLog);
  expect(callbacks.onUploadDeck).toHaveBeenCalledOnce();
});

it("Download Cards and Download Review log each call their own callback", () => {
  const callbacks = renderFilesPanel();

  fireEvent.click(screen.getByRole("button", { name: "Download Cards" }));
  expect(callbacks.onDownloadCards).toHaveBeenCalledOnce();
  expect(callbacks.onDownloadReviewLog).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Download Review log" }));
  expect(callbacks.onDownloadReviewLog).toHaveBeenCalledOnce();
  expect(callbacks.onDownloadCards).toHaveBeenCalledOnce();
});

it.each([
  { case: "no download yet", lastDownload: undefined, note: "No download yet", warning: true },
  {
    case: "a download today",
    lastDownload: downloadedAgo(0),
    note: "Days since the last download: 0",
    warning: false,
  },
  {
    case: "a download 7 days ago",
    lastDownload: downloadedAgo(7 * DAY_MS),
    note: "Days since the last download: 7",
    warning: false,
  },
  {
    case: "a download 7 days and 23 hours ago",
    lastDownload: downloadedAgo(7 * DAY_MS + 23 * 60 * 60 * 1000),
    note: "Days since the last download: 7",
    warning: false,
  },
  {
    case: "a download 8 days ago",
    lastDownload: downloadedAgo(8 * DAY_MS),
    note: "Days since the last download: 8",
    warning: true,
  },
])(
  "the backup note with $case is in warning style: $warning",
  ({ lastDownload, note, warning }) => {
    renderFilesPanel({ lastDownload });

    const shown = backupNote(note);

    expect(shown.classList.contains("warning")).toBe(warning);
    const icons = shown.querySelectorAll("svg");
    expect(icons).toHaveLength(1);
    expect(icons[0].getAttribute("aria-hidden")).toBe("true");
  },
);

it("the backup note shows a different icon in warning style than in success style", () => {
  const { unmount } = renderFilesPanel({ lastDownload: downloadedAgo(8 * DAY_MS) });
  const warning = backupNote("Days since the last download: 8").querySelector("svg")!.innerHTML;
  unmount();

  renderFilesPanel({ lastDownload: downloadedAgo(DAY_MS) });
  const success = backupNote("Days since the last download: 1").querySelector("svg")!.innerHTML;

  expect(warning).not.toBe(success);
});

it("shows no report before an upload", () => {
  renderFilesPanel();

  expect(screen.queryByText("Upload result")).toBeNull();
  expect(screen.queryByText("File rejected")).toBeNull();
  expect(document.querySelector(".alert")).toBeNull();
});

it("shows an accepted Deck as a success alert with Upload result and the counts", () => {
  renderFilesPanel({ report: { ok: true, added: 2, updated: 1, unchanged: 3, errors: [] } });

  const alert = alertOf("Upload result");

  expect(alert.classList.contains("success")).toBe(true);
  expect(alert.textContent).toContain("2 added, 1 updated, 3 unchanged");
  expect(screen.queryByText("File rejected")).toBeNull();
});

it("an accepted Deck still lists the Cards it rejected", () => {
  renderFilesPanel({
    report: {
      ok: true,
      added: 1,
      updated: 0,
      unchanged: 0,
      errors: [{ where: "ml.trees.depth", field: "en.answer", message: "Too short" }],
    },
  });

  const alert = alertOf("Upload result");

  expect(alert.classList.contains("success")).toBe(true);
  expect(screen.getByText("ml.trees.depth: en.answer: Too short")).toBeTruthy();
});

it("shows an accepted Review log as a success alert with Upload result and the counts", () => {
  renderFilesPanel({ report: { ok: true, added: 1, skipped: 2 } });

  const alert = alertOf("Upload result");

  expect(alert.classList.contains("success")).toBe(true);
  expect(alert.textContent).toContain("1 added, 2 skipped");
});

it("shows a rejected file as a danger alert with File rejected and each error", () => {
  renderFilesPanel({
    report: {
      ok: false,
      errors: [
        { where: "review 1", field: "cardVersion", message: "Too small" },
        { message: "Not JSON" },
      ],
    },
  });

  const alert = alertOf("File rejected");

  expect(alert.classList.contains("danger")).toBe(true);
  expect(screen.getByText("review 1: cardVersion: Too small")).toBeTruthy();
  expect(screen.getByText("Not JSON")).toBeTruthy();
  expect(screen.queryByText("Upload result")).toBeNull();
});

it("the report doesn't interrupt, so only errors are alerts", () => {
  renderFilesPanel({ report: { ok: false, errors: [{ message: "Not JSON" }] } });

  expect(screen.queryByRole("alert")).toBeNull();
});

it("shows the report in German", () => {
  renderFilesPanel({ report: { ok: true, added: 1, skipped: 0 } }, "de");

  expect(alertOf("Ergebnis des Hochladens").textContent).toContain("1 hinzugefügt, 0 übersprungen");
});
