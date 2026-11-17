import type { TCard } from "@flashcards/cards";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { downloadDeck, uploadDeck, type TUploadReport } from "./deck";
import { downloadReviewLog, uploadReviewLog, type TReviewLogReport } from "./review.log";
import { browserLanguage, LanguageContext, type TLanguage } from "./language.context";
import { Session } from "./Session";
import { allTags, pickCards } from "./session.helper";
import { Statistics } from "./Statistics";
import {
  clearCards,
  deleteCard,
  loadCards,
  loadLastDownload,
  loadReviews,
  type TReview,
} from "./storage";

const DAY_MS = 24 * 60 * 60 * 1000;

function summary(report: TUploadReport | TReviewLogReport): string {
  if (!report.ok) return "File rejected";
  return "skipped" in report
    ? `${report.added} added, ${report.skipped} skipped`
    : `${report.added} added, ${report.updated} updated, ${report.unchanged} unchanged`;
}

export function App() {
  const [cards, setCards] = useState<TCard[]>([]);
  const [report, setReport] = useState<TUploadReport | TReviewLogReport>();
  const [error, setError] = useState<string>();
  const [size, setSize] = useState(20);
  const [tag, setTag] = useState("");
  const [session, setSession] = useState<TCard[]>();
  const [reviews, setReviews] = useState<TReview[]>();
  const [lastDownload, setLastDownload] = useState<string>();
  const [language] = useState<TLanguage>(browserLanguage);
  // Counts uploads, so a slower earlier upload can't overwrite a newer one's report or error.
  const uploads = useRef(0);

  useEffect(() => {
    // Ask the browser not to evict the stored Cards.
    void navigator.storage?.persist();
    loadCards().then(setCards, showError);
    loadLastDownload().then(setLastDownload, showError);
  }, []);

  function showError(failure: unknown) {
    setError(failure instanceof Error ? failure.message : String(failure));
  }

  async function upload(
    event: ChangeEvent<HTMLInputElement>,
    read: (text: string) => Promise<TUploadReport | TReviewLogReport>,
  ) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    // Clear the input so picking the same file again triggers another change.
    input.value = "";
    const current = ++uploads.current;
    try {
      const result = await read(await file.text());
      // Cards come from storage, so even an outdated upload refreshes the list.
      setCards(await loadCards());
      if (current !== uploads.current) return;
      setReport(result);
      setError(undefined);
    } catch (failure) {
      if (current !== uploads.current) return;
      setReport(undefined);
      showError(failure);
    }
  }

  async function download(save: () => Promise<unknown>) {
    try {
      await save();
      setError(undefined);
    } catch (failure) {
      showError(failure);
    }
  }

  async function remove(change: () => Promise<void>) {
    try {
      await change();
      setCards(await loadCards());
      setError(undefined);
    } catch (failure) {
      showError(failure);
    }
  }

  async function clearAll() {
    if (!window.confirm("Delete all Cards?")) return;
    await remove(clearCards);
  }

  const tags = allTags(cards);
  // A picked tag can vanish when Cards are deleted or replaced; the select then shows "Any tag".
  const pickedTag = tags.includes(tag) ? tag : "";

  if (reviews) {
    return (
      <LanguageContext.Provider value={language}>
        <h1>Flashcards</h1>
        {error && <p role="alert">{error}</p>}
        <Statistics cards={cards} reviews={reviews} onBack={() => setReviews(undefined)} />
      </LanguageContext.Provider>
    );
  }

  if (session) {
    return (
      <LanguageContext.Provider value={language}>
        <h1>Flashcards</h1>
        {error && <p role="alert">{error}</p>}
        <Session cards={session} onEnd={() => setSession(undefined)} onError={showError} />
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={language}>
      <h1>Flashcards</h1>
      {error && <p role="alert">{error}</p>}
      <label>
        Cards{" "}
        <input
          type="number"
          value={size}
          onChange={(event) => setSize(event.target.valueAsNumber)}
        />
      </label>{" "}
      <label>
        Tag{" "}
        <select value={pickedTag} onChange={(event) => setTag(event.target.value)}>
          <option value="">Any tag</option>
          {tags.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>{" "}
      {/* An empty input gives NaN, so `size < 1` would let it through. */}
      <button
        disabled={cards.length === 0 || !(size >= 1)}
        onClick={() =>
          loadReviews().then(
            (log) => setSession(pickCards(cards, log, size, pickedTag || undefined)),
            showError,
          )
        }
      >
        Start Session
      </button>{" "}
      <button onClick={() => loadReviews().then(setReviews, showError)}>Statistics</button>
      <p>
        <label>
          Upload Deck{" "}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => upload(event, uploadDeck)}
          />
        </label>{" "}
        <label>
          Upload Review log{" "}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => upload(event, uploadReviewLog)}
          />
        </label>
      </p>
      <p>
        <button onClick={() => download(downloadDeck)}>Download Cards</button>{" "}
        <button onClick={() => download(async () => setLastDownload(await downloadReviewLog()))}>
          Download Review log
        </button>
      </p>
      <p>
        {lastDownload
          ? `Days since the last download: ${Math.floor((Date.now() - Date.parse(lastDownload)) / DAY_MS)}`
          : "No download yet"}
      </p>
      {report && (
        <section>
          <p>{summary(report)}</p>
          <ul>
            {("errors" in report ? report.errors : []).map((fileError, i) => (
              <li key={i}>
                {[fileError.where, fileError.field, fileError.message].filter(Boolean).join(": ")}
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            {card.id} ({card.type}, version {card.version}){" "}
            <button
              aria-label={`Delete ${card.id}`}
              onClick={() => remove(() => deleteCard(card.id))}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      {cards.length > 0 && <button onClick={clearAll}>Clear all</button>}
    </LanguageContext.Provider>
  );
}
