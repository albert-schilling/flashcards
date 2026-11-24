import type { TCard } from "@flashcards/cards";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { downloadDeck, uploadDeck, type TUploadReport } from "./deck";
import { downloadReviewLog, uploadReviewLog, type TReviewLogReport } from "./review.log";
import { browserLanguage, LanguageContext, type TLanguage } from "./language.context";
import { Alert } from "./Alert";
import { CardsPage } from "./CardsPage";
import { FilesPanel } from "./FilesPanel";
import { Header, type TPage } from "./Header";
import { Home } from "./Home";
import { Session } from "./Session";
import { Settings } from "./Settings";
import { allTags, pickCards } from "./session.helper";
import { Statistics } from "./Statistics";
import {
  clearCards,
  deleteCard,
  loadCards,
  loadLanguage,
  loadLastDownload,
  loadReviews,
  saveCards,
  saveLanguage,
  type TReview,
} from "./storage";

export function App() {
  const [cards, setCards] = useState<TCard[]>([]);
  const [report, setReport] = useState<TUploadReport | TReviewLogReport>();
  const [error, setError] = useState<string>();
  const [size, setSize] = useState(20);
  const [tag, setTag] = useState("");
  const [page, setPage] = useState<TPage>("home");
  // Whether the Cards page opens with the Card editor open, as Home's Create Card asks.
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState<{ id: number; cards: TCard[] }>();
  const [reviews, setReviews] = useState<TReview[]>();
  const [lastDownload, setLastDownload] = useState<string>();
  const [language, setLanguage] = useState<TLanguage>(browserLanguage);
  // Counts uploads, so a slower earlier upload can't overwrite a newer one's report or error.
  const uploads = useRef(0);

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

  // Whether the change was saved and the Cards reloaded; a failure shows the error and gives false.
  async function update(change: () => Promise<void>): Promise<boolean> {
    try {
      await change();
      setCards(await loadCards());
      setError(undefined);
      return true;
    } catch (failure) {
      showError(failure);
      return false;
    }
  }

  const tags = allTags(cards);
  // A picked tag can vanish when Cards are deleted or replaced; the select then shows "Any tag".
  const pickedTag = tags.includes(tag) ? tag : "";

  // An empty Cards input gives NaN, so `size < 1` would let it through.
  const canStart = cards.length > 0 && size >= 1;

  function openStatistics() {
    return loadReviews().then((log) => {
      setReviews(log);
      setPage("statistics");
    }, showError);
  }

  function startSession() {
    return loadReviews().then((log) => {
      setSession({
        id: (session?.id ?? 0) + 1,
        cards: pickCards(cards, log, size, pickedTag || undefined),
      });
      setPage("session");
    }, showError);
  }

  function navigate(target: TPage) {
    setCreating(false);
    if (target === "statistics") void openStatistics();
    else if (target === "session") {
      if (session) setPage("session");
      else void startSession();
    } else setPage(target);
  }

  return (
    <LanguageContext.Provider value={language}>
      <Header page={page} onNavigate={navigate} sessionDisabled={!session && !canStart} />
      <main className={page === "session" ? "session-page" : "page-shell"}>
        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}
        {session && (
          // Hidden, not unmounted, so a Session keeps its place while another page shows.
          <div hidden={page !== "session"}>
            <Session
              key={session.id}
              cards={session.cards}
              shown={page === "session"}
              onBack={() => setPage("home")}
              onEnd={() => {
                setSession(undefined);
                setPage("home");
              }}
              onError={showError}
            />
          </div>
        )}
        {page === "cards" && (
          <CardsPage
            cards={cards}
            onDelete={(id) => update(() => deleteCard(id))}
            onDeleteAll={() => void update(clearCards)}
            onSave={(card) => update(() => saveCards([card]))}
            creating={creating}
          >
            <FilesPanel
              report={report}
              lastDownload={lastDownload}
              onUploadDeck={(event) => upload(event, uploadDeck)}
              onUploadReviewLog={(event) => upload(event, uploadReviewLog)}
              onDownloadCards={() => download(downloadDeck)}
              onDownloadReviewLog={() =>
                download(async () => setLastDownload(await downloadReviewLog()))
              }
            />
          </CardsPage>
        )}
        {page === "settings" && <Settings onLanguage={pickLanguage} />}
        {page === "statistics" && reviews && (
          <Statistics
            cards={cards}
            reviews={reviews}
            onBack={() => {
              setReviews(undefined);
              setPage("home");
            }}
          />
        )}
        {page === "home" && (
          <Home
            cardCount={cards.length}
            size={size}
            onSize={setSize}
            tags={tags}
            tag={pickedTag}
            onTag={setTag}
            canStart={canStart}
            onStart={() => void startSession()}
            onStatistics={() => void openStatistics()}
            onCards={() => navigate("cards")}
            onCreateCard={() => {
              navigate("cards");
              setCreating(true);
            }}
          />
        )}
      </main>
    </LanguageContext.Provider>
  );
}
