import type { TCard } from "@flashcards/cards";
import { useEffect, useState, type ChangeEvent } from "react";
import { uploadDeck, type TUploadReport } from "./deck";
import { Session } from "./Session";
import { allTags, pickCards } from "./session.helper";
import { Statistics } from "./Statistics";
import { clearCards, deleteCard, loadCards, loadReviews, type TReview } from "./storage";

export function App() {
  const [cards, setCards] = useState<TCard[]>([]);
  const [report, setReport] = useState<TUploadReport>();
  const [error, setError] = useState<string>();
  const [size, setSize] = useState(20);
  const [tag, setTag] = useState("");
  const [session, setSession] = useState<TCard[]>();
  const [reviews, setReviews] = useState<TReview[]>();

  useEffect(() => {
    // Ask the browser not to evict the stored Cards.
    void navigator.storage?.persist();
    loadCards().then(setCards, showError);
  }, []);

  function showError(failure: unknown) {
    setError(failure instanceof Error ? failure.message : String(failure));
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    // Clear the input so picking the same file again triggers another change.
    input.value = "";
    try {
      setReport(await uploadDeck(await file.text()));
      setCards(await loadCards());
      setError(undefined);
    } catch (failure) {
      setReport(undefined);
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
      <>
        <h1>Flashcards</h1>
        {error && <p role="alert">{error}</p>}
        <Statistics cards={cards} reviews={reviews} onBack={() => setReviews(undefined)} />
      </>
    );
  }

  if (session) {
    return (
      <>
        <h1>Flashcards</h1>
        {error && <p role="alert">{error}</p>}
        <Session cards={session} onEnd={() => setSession(undefined)} onError={showError} />
      </>
    );
  }

  return (
    <>
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
        onClick={() => setSession(pickCards(cards, size, pickedTag || undefined))}
      >
        Start Session
      </button>
      <button onClick={() => loadReviews().then(setReviews, showError)}>Statistics</button>
      <input
        type="file"
        aria-label="Upload Deck"
        accept=".json,application/json"
        onChange={upload}
      />
      {report && (
        <section>
          <p>
            {report.ok
              ? `${report.added} added, ${report.updated} updated, ${report.unchanged} unchanged`
              : "File rejected"}
          </p>
          <ul>
            {report.errors.map((deckError, i) => (
              <li key={i}>
                {[deckError.cardId, deckError.field, deckError.message].filter(Boolean).join(": ")}
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
    </>
  );
}
