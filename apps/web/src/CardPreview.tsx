import type { TCard } from "@flashcards/cards";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useContext } from "react";
import { cardAnswer, cardTitle } from "./CardView";
import { LanguageContext, useText } from "./language.context";
import { Modal } from "./Modal";
import { RowTags } from "./RowTags";

/** Delete deletes without asking. Edit shows only with `onEdit`, and Add to current Session is disabled without `onAddToSession`. */
export function CardPreview(props: {
  card: TCard;
  onClose: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onAddToSession?: () => void;
  onNewSession: () => void;
}) {
  const text = useText();
  const language = useContext(LanguageContext);
  const { card } = props;
  return (
    <Modal title={text.cardPreview} onClose={props.onClose}>
      <div className="modal-body card-preview">
        <span className="type-label">{text.cardTypes[card.type]}</span>
        <h3>{cardTitle(card, language)}</h3>
        <div className="preview-answer">
          <span>{text.answer}</span>
          {cardAnswer(card, language).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <RowTags tags={card.tags} />
        <p className="preview-id">{text.cardIdAndVersion(card.id, card.version)}</p>
      </div>
      <div className="modal-actions modal-actions-wrap">
        <button className="button danger" onClick={props.onDelete}>
          <Trash2 size={17} aria-hidden="true" />
          {text.delete}
        </button>
        {props.onEdit && (
          <button className="button secondary" onClick={props.onEdit}>
            <Pencil size={17} aria-hidden="true" />
            {text.edit}
          </button>
        )}
        <button
          className="button secondary"
          disabled={!props.onAddToSession}
          onClick={props.onAddToSession}
        >
          <Play size={17} aria-hidden="true" />
          {text.addToSession}
        </button>
        <button className="button primary" onClick={props.onNewSession}>
          <Plus size={17} aria-hidden="true" />
          {text.newSession}
        </button>
      </div>
    </Modal>
  );
}
