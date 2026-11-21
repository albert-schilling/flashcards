import type { TCard } from "@flashcards/cards";
import { Trash2 } from "lucide-react";
import { useContext } from "react";
import { cardAnswer, cardTitle } from "./CardView";
import { LanguageContext, useText } from "./language.context";
import { Modal } from "./Modal";

/** The Card preview: a Modal with the Card's type, its question and answer in the current language (see cardTitle and cardAnswer), its tags, its ID and version, and Delete, which deletes without asking. Edit and the Session buttons come later. */
export function CardPreview(props: { card: TCard; onClose: () => void; onDelete: () => void }) {
  const text = useText();
  const language = useContext(LanguageContext);
  const { card } = props;
  return (
    <Modal title={text.cardPreview} onClose={props.onClose}>
      <div className="modal-body card-preview">
        <span className="type-label">{card.type}</span>
        <h3>{cardTitle(card, language)}</h3>
        <div className="preview-answer">
          <span>{text.answer}</span>
          {cardAnswer(card, language).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <div className="row-tags">
          {[...card.tags.domain, ...card.tags.topic].map((tag, i) => (
            <span key={i}>{tag}</span>
          ))}
        </div>
        <p className="preview-id">{text.cardIdAndVersion(card.id, card.version)}</p>
      </div>
      <div className="modal-actions modal-actions-wrap">
        <button className="button danger" onClick={props.onDelete}>
          <Trash2 size={17} aria-hidden="true" />
          {text.delete}
        </button>
      </div>
    </Modal>
  );
}
