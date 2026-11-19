import type { TCard } from "@flashcards/cards";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { downloadDeck, uploadDeck, type TUploadReport } from "./deck";
import { downloadReviewLog, uploadReviewLog, type TReviewLogReport } from "./review.log";
import { browserLanguage, LanguageContext, type TLanguage } from "./language.context";
import { Alert } from "./Alert";
import { FileButton } from "./FileButton";
import { Select } from "./Select";
import { Session } from "./Session";
import { allTags, pickCards } from "./session.helper";
import { Statistics } from "./Statistics";
import {
  clearCards,
  deleteCard,
  loadCards,
  loadLanguage,
  loadLastDownload,
  loadReviews,
  saveLanguage,
  type TReview,
} from "./storage";
import { uiText, type TUiText } from "./ui.text";

const DAY_MS = 24 * 60 * 60 * 1000;

function summary(report: TUploadReport | TReviewLogReport, text: TUiText): string {
  if (!report.ok) return text.fileRejected;
  return "skipped" in report
    ? text.reviewLogSummary(report.added, report.skipped)
    : text.deckSummary(report.added, report.updated, report.unchanged);
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
  const [language, setLanguage] = useState<TLanguage>(browserLanguage);
  // Counts uploads, so a slower earlier upload can't overwrite a newer one's report or error.
  const uploads = useRef(0);
  // App provides the language context, so it can't read it.
  const text = uiText[language];

  useEffect(() => {
    // Ask the browser not to evict the stored Cards.
    void navigator.storage?.persist();
    loadCards().then(setCards, showError);
    loadLastDownload().then(setLastDownload, showError);
    // The stored choice wins over the browser language.
    loadLanguage().then((picked) => picked && setLanguage(picked), showError);
  }, []);

  async function pickLanguage(picked: TLanguage) {
    // The language changes for this visit even when saving fails.
    setLanguage(picked);
    try {
      await saveLanguage(picked);
      setError(undefined);
    } catch (failure) {
      showError(failure);
    }
  }

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
    if (!window.confirm(text.confirmClearAll)) return;
    await remove(clearCards);
  }

  const tags = allTags(cards);
  // A picked tag can vanish when Cards are deleted or replaced; the select then shows "Any tag".
  const pickedTag = tags.includes(tag) ? tag : "";

  if (reviews) {
    return (
      <LanguageContext.Provider value={language}>
        <h1>Flashcards</h1>
        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}
        <Statistics cards={cards} reviews={reviews} onBack={() => setReviews(undefined)} />
      </LanguageContext.Provider>
    );
  }

  if (session) {
    return (
      <LanguageContext.Provider value={language}>
        <h1>Flashcards</h1>
        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}
        <Session cards={session} onEnd={() => setSession(undefined)} onError={showError} />
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={language}>
      <h1>Flashcards</h1>
      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}
      <label className="field">
        {text.language}
        <Select
          value={language}
          onChange={(event) => pickLanguage(event.target.value as TLanguage)}
        >
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </Select>
      </label>
      <label className="field">
        {text.cards}
        <input
          className="control"
          type="number"
          value={size}
          onChange={(event) => setSize(event.target.valueAsNumber)}
        />
      </label>
      <label className="field">
        {text.tag}
        <Select value={pickedTag} onChange={(event) => setTag(event.target.value)}>
          <option value="">{text.anyTag}</option>
          {tags.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </Select>
      </label>
      {/* An empty input gives NaN, so `size < 1` would let it through. */}
      <button
        className="button primary"
        disabled={cards.length === 0 || !(size >= 1)}
        onClick={() =>
          loadReviews().then(
            (log) => setSession(pickCards(cards, log, size, pickedTag || undefined)),
            showError,
          )
        }
      >
        {text.startSession}
      </button>{" "}
      <button
        className="button secondary"
        onClick={() => loadReviews().then(setReviews, showError)}
      >
        {text.statistics}
      </button>
      <p>
        <FileButton
          label={text.uploadDeck}
          accept=".json,application/json"
          onChange={(event) => upload(event, uploadDeck)}
        />{" "}
        <FileButton
          label={text.uploadReviewLog}
          accept=".json,application/json"
          onChange={(event) => upload(event, uploadReviewLog)}
        />
      </p>
      <p>
        <button className="button ghost" onClick={() => download(downloadDeck)}>
          {text.downloadCards}
        </button>{" "}
        <button
          className="button ghost"
          onClick={() => download(async () => setLastDownload(await downloadReviewLog()))}
        >
          {text.downloadReviewLog}
        </button>
      </p>
      <p>
        {lastDownload
          ? text.daysSinceDownload(Math.floor((Date.now() - Date.parse(lastDownload)) / DAY_MS))
          : text.noDownloadYet}
      </p>
      {report && (
        <Alert tone={report.ok ? "success" : "danger"}>
          <p>{summary(report, text)}</p>
          <ul>
            {("errors" in report ? report.errors : []).map((fileError, i) => (
              <li key={i}>
                {[fileError.where, fileError.field, fileError.message].filter(Boolean).join(": ")}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            {text.cardListItem(card.id, card.type, card.version)}{" "}
            <button
              className="button ghost small"
              aria-label={text.deleteCard(card.id)}
              onClick={() => remove(() => deleteCard(card.id))}
            >
              {text.delete}
            </button>
          </li>
        ))}
      </ul>
      {cards.length > 0 && (
        <button className="button danger" onClick={clearAll}>
          {text.clearAll}
        </button>
      )}
    </LanguageContext.Provider>
  );
}
