import type { TCard } from "@flashcards/cards";
import { Pencil, Trash2 } from "lucide-react";
import { useContext } from "react";
import { isEditable } from "./card.editor.helper";
import { cardAnswer, cardTitle } from "./CardView";
import { LanguageContext, useText } from "./language.context";
import { Modal } from "./Modal";
import { RowTags } from "./RowTags";

/** The Card preview: a Modal with the Card's type name, its question and answer in the current language (see cardTitle and cardAnswer), its tags, its ID and version, Edit (only for qa, cloze and true_false Cards), which opens the Card editor, and Delete, which deletes without asking. The Session buttons come later. */
export function CardPreview(props: {
  card: TCard;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
        {isEditable(card) && (
          <button className="button secondary" onClick={props.onEdit}>
            <Pencil size={17} aria-hidden="true" />
            {text.edit}
          </button>
        )}
        <button className="button danger" onClick={props.onDelete}>
          <Trash2 size={17} aria-hidden="true" />
          {text.delete}
        </button>
      </div>
    </Modal>
  );
}
