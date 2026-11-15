import type { TCard } from "@flashcards/cards";
import { useEffect, useState, type ChangeEvent } from "react";
import { uploadDeck, type TUploadReport } from "./deck";
import { loadCards } from "./storage";

export function App() {
  const [cards, setCards] = useState<TCard[]>([]);
  const [report, setReport] = useState<TUploadReport>();
  const [error, setError] = useState<string>();

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
      showError(failure);
    }
  }

  return (
    <>
      <h1>Flashcards</h1>
      {error && <p role="alert">{error}</p>}
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
            {report.errors.map((error, i) => (
              <li key={i}>
                {[error.cardId, error.field, error.message].filter(Boolean).join(": ")}
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            {card.id} ({card.type}, version {card.version})
          </li>
        ))}
      </ul>
    </>
  );
}
