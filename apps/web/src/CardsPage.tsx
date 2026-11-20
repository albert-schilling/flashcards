import type { TCard } from "@flashcards/cards";
import { Trash2 } from "lucide-react";
import { useContext, useState } from "react";
import { Alert } from "./Alert";
import { cardTitle } from "./CardView";
import { EmptyState } from "./EmptyState";
import { LanguageContext, useText } from "./language.context";
import { Modal } from "./Modal";
import { PageHeading } from "./PageHeading";

/** The Cards page: the Library heading, then a panel with the Card count, one row per Card (question or name in the current language, ID, type, all tags, Delete) and Delete all, which asks in a modal first and closes it before deleting. With no Cards the panel shows the empty state. App owns the Cards and does the deleting. */
export function CardsPage(props: {
  cards: TCard[];
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}) {
  const text = useText();
  const language = useContext(LanguageContext);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function deleteAll() {
    // Close first, so a failure shows in the page's error and not behind the modal.
    setConfirmingDelete(false);
    props.onDeleteAll();
  }

  return (
    <>
      <div className="cards-page-heading">
        <PageHeading eyebrow={text.library} title={text.cards} intro={text.cardsIntro} />
      </div>
      <div className="cards-layout">
        <section className="panel library-panel">
          <div className="library-summary">
            <span>{text.cardCount(props.cards.length)}</span>
          </div>
          {props.cards.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="library-list">
              {props.cards.map((card) => (
                <li className="library-card-row" key={card.id}>
                  <div className="library-card-copy">
                    <strong>{cardTitle(card, language)}</strong>
                    <span className="card-id">{card.id}</span>
                    <div className="row-tags">
                      <span>{card.type}</span>
                      {[...card.tags.domain, ...card.tags.topic].map((tag, i) => (
                        <span key={i}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="button ghost small"
                    aria-label={text.deleteCard(card.id)}
                    onClick={() => props.onDelete(card.id)}
                  >
                    {text.delete}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="text-button danger-text delete-all-button"
            disabled={props.cards.length === 0}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={17} aria-hidden="true" />
            {text.deleteAllCards}
          </button>
        </section>
      </div>
      {confirmingDelete && (
        <Modal title={text.deleteAllCardsTitle} onClose={() => setConfirmingDelete(false)}>
          <div className="modal-body">
            <Alert tone="danger">
              <strong>{text.cannotBeUndone}</strong>
              <p>{text.deleteAllWarning(props.cards.length)}</p>
            </Alert>
          </div>
          <div className="modal-actions">
            <button className="button ghost" onClick={() => setConfirmingDelete(false)}>
              {text.cancel}
            </button>
            <button className="button danger" onClick={deleteAll}>
              {text.deleteAllCards}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
