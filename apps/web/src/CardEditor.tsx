import type { TCard } from "@flashcards/cards";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import {
  cardOf,
  draftOf,
  editorTypes,
  emptyDraft,
  suggestId,
  type TCardDraft,
  type TDraftText,
  type TEditableCard,
  type TEditorType,
} from "./card.editor";
import { useText } from "./language.context";
import { Modal } from "./Modal";
import { Select } from "./Select";

type TControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };

// A labelled field; `control` gets the attributes that link it to its label, hint and error.
function Field(props: {
  label: string;
  hint?: string;
  error?: string;
  control: (attributes: TControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = props.hint ? `${id}-hint` : undefined;
  const errorId = props.error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      {props.control({
        id,
        ...(describedBy && { "aria-describedby": describedBy }),
        ...(errorId && { "aria-invalid": true }),
      })}
      {props.hint && <small id={hintId}>{props.hint}</small>}
      {props.error && (
        <small id={errorId} className="field-error">
          {props.error}
        </small>
      )}
    </div>
  );
}

// The draft field each type's ID is suggested from.
const titleField: Record<TEditorType, "question" | "text" | "statement"> = {
  qa: "question",
  cloze: "text",
  true_false: "statement",
};

/** The Card editor: a Modal titled Create Card, or Edit Card with `card`, showing the fields of the picked type (qa, cloze or true_false), then the ID, the domain and topic tags, the lesson and the type's optional German fields. A new Card's ID is suggested from its text until the Learner types one; an edited Card's ID is read-only. Create Card or Save changes shows each field's error under it, kept up to date as the Learner types, until the form makes a valid Card, then calls onSave with it; `takenIds` are the IDs a new Card may not have. */
export function CardEditor(props: {
  card?: TEditableCard;
  takenIds: string[];
  onSave: (card: TCard) => void;
  onClose: () => void;
}) {
  const text = useText();
  const [draft, setDraft] = useState(() => (props.card ? draftOf(props.card) : emptyDraft()));
  const [idTyped, setIdTyped] = useState(props.card !== undefined);
  const [tried, setTried] = useState(false);
  const result = cardOf(draft, props.takenIds, props.card);
  const errors = tried && !result.ok ? result.errors : {};

  // Until the Learner types an ID, it follows the text the Card is listed by.
  function change(changes: Partial<TCardDraft>) {
    const suggest = !idTyped && !("id" in changes);
    setDraft((old) => {
      const next = { ...old, ...changes };
      return suggest ? { ...next, id: suggestId(next[titleField[next.type]]) } : next;
    });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (result.ok) props.onSave(result.card);
  }

  function textField(key: TDraftText, label: string, hint?: string) {
    return (
      <Field
        key={key}
        label={label}
        hint={hint}
        error={errors[key] && text.fieldErrors[errors[key]]}
        control={(attributes) => (
          <textarea
            {...attributes}
            className="control"
            value={draft[key]}
            onChange={(event) => change({ [key]: event.target.value })}
          />
        )}
      />
    );
  }

  function lineField(key: TDraftText, label: string, hint?: string, placeholder?: string) {
    return (
      <Field
        label={label}
        hint={hint}
        error={errors[key] && text.fieldErrors[errors[key]]}
        control={(attributes) => (
          <input
            {...attributes}
            className="control"
            value={draft[key]}
            placeholder={placeholder}
            readOnly={key === "id" && props.card !== undefined}
            onChange={(event) => {
              if (key === "id") setIdTyped(true);
              change({ [key]: event.target.value });
            }}
          />
        )}
      />
    );
  }

  const english: Record<TEditorType, ReactNode> = {
    qa: [textField("question", text.question), textField("answer", text.answer)],
    cloze: textField("text", text.clozeText, text.clozeHint),
    true_false: [
      textField("statement", text.statement),
      <Field
        key="isTrue"
        label={text.answer}
        control={(attributes) => (
          <Select
            {...attributes}
            value={String(draft.isTrue)}
            onChange={(event) => change({ isTrue: event.target.value === "true" })}
          >
            <option value="true">{text.true}</option>
            <option value="false">{text.false}</option>
          </Select>
        )}
      />,
    ],
  };
  const german: Record<TEditorType, ReactNode> = {
    qa: [
      textField("germanQuestion", text.inGerman(text.question)),
      textField("germanAnswer", text.inGerman(text.answer)),
    ],
    cloze: textField("germanText", text.inGerman(text.clozeText)),
    true_false: textField("germanStatement", text.inGerman(text.statement)),
  };

  return (
    <Modal title={props.card ? text.editCard : text.createCard} onClose={props.onClose}>
      <form noValidate onSubmit={save}>
        <div className="modal-body editor-form">
          <Field
            label={text.type}
            control={(attributes) => (
              <Select
                {...attributes}
                value={draft.type}
                onChange={(event) => change({ type: event.target.value as TEditorType })}
              >
                {editorTypes.map((type) => (
                  <option key={type} value={type}>
                    {text.cardTypes[type]}
                  </option>
                ))}
              </Select>
            )}
          />
          {english[draft.type]}
          {lineField("id", text.cardId, text.idHint)}
          {lineField("domainTags", text.domainTags, text.tagsHint, text.domainTagsExample)}
          {lineField("topicTags", text.topicTags, text.tagsHint, text.topicTagsExample)}
          {lineField("lesson", text.lesson)}
          {german[draft.type]}
        </div>
        <div className="modal-actions">
          <button type="button" className="button ghost" onClick={props.onClose}>
            {text.cancel}
          </button>
          <button type="submit" className="button primary">
            {props.card ? text.saveChanges : text.createCard}
          </button>
        </div>
      </form>
    </Modal>
  );
}
