import type { TCard } from "@flashcards/cards";
import { useEffect, useState, type ChangeEvent } from "react";
import { uploadDeck, type TUploadReport } from "./deck";
import { loadCards } from "./storage";

export function App() {
  const [cards, setCards] = useState<TCard[]>([]);
  const [report, setReport] = useState<TUploadReport>();

  useEffect(() => {
    // Ask the browser not to evict the stored Cards.
    void navigator.storage?.persist();
    void loadCards().then(setCards);
  }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReport(await uploadDeck(await file.text()));
    setCards(await loadCards());
  }

  return (
    <>
      <h1>Flashcards</h1>
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
