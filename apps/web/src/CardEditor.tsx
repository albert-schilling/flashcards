import type { TCard } from "@flashcards/cards";
import { useId, useState, type ReactNode } from "react";
import {
  cardFromDraft,
  draftFromCard,
  editableTypes,
  emptyDraft,
  mainText,
  suggestId,
  type TDraft,
  type TDraftField,
  type TFieldError,
} from "./editor.helper";
import { useText } from "./language.context";
import { Modal } from "./Modal";
import { Select } from "./Select";

/** A labelled control with an optional hint and, once Save was pressed, its error, which the control points to. */
function Field(props: {
  label: string;
  hint?: string;
  error?: string;
  control: (aria: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [props.hint && hintId, props.error && errorId].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      {props.control({
        id,
        ...(props.error && { "aria-invalid": true }),
        ...(describedBy && { "aria-describedby": describedBy }),
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

/** The Card editor: a Modal titled Create Card, or Edit Card with `card`, holding the fields of the picked Card type (qa, cloze or true_false), their optional German fields, the ID, lesson and tags. Until the Learner types an ID, it is suggested from the English text; an edited Card keeps its ID. Save shows each invalid field's error, or calls onSave with the Card (see cardFromDraft). */
export function CardEditor(props: {
  card?: Extract<TCard, { type: TDraft["type"] }>;
  takenIds: string[];
  onSave: (card: TCard) => void;
  onClose: () => void;
}) {
  const text = useText();
  const [draft, setDraft] = useState(() => (props.card ? draftFromCard(props.card) : emptyDraft));
  const [idTyped, setIdTyped] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<TDraftField, TFieldError>>>({});
  const editing = props.card !== undefined;
  const id = editing || idTyped ? draft.id : suggestId(mainText(draft));

  function set<Field extends TDraftField>(field: Field, value: TDraft[Field]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function save() {
    const result = cardFromDraft({ ...draft, id }, props.takenIds, props.card);
    if ("errors" in result) setErrors(result.errors);
    else props.onSave(result.card);
  }

  function error(field: TDraftField) {
    const found = errors[field];
    return found && text.fieldErrors[found];
  }

  function textField(field: TDraftField, label: string, multiline: boolean, hint?: string) {
    return (
      <Field
        key={field}
        label={label}
        hint={hint}
        error={error(field)}
        control={(aria) => {
          const shared = {
            ...aria,
            className: "control",
            value: String(draft[field]),
            onChange: (event: { target: { value: string } }) => set(field, event.target.value),
          };
          return multiline ? <textarea {...shared} /> : <input {...shared} />;
        }}
      />
    );
  }

  const typeFields = {
    qa: [
      textField("question", text.question, true),
      textField("answer", text.answer, true),
      textField("questionDe", text.inGerman(text.question), true),
      textField("answerDe", text.inGerman(text.answer), true),
    ],
    cloze: [
      textField("text", text.clozeText, true, text.clozeHint),
      textField("textDe", text.inGerman(text.clozeText), true),
    ],
    true_false: [
      textField("statement", text.statement, true),
      <Field
        key="truth"
        label={text.answer}
        control={(aria) => (
          <Select
            {...aria}
            value={String(draft.truth)}
            onChange={(event) => set("truth", event.target.value === "true")}
          >
            <option value="true">{text.true}</option>
            <option value="false">{text.false}</option>
          </Select>
        )}
      />,
      textField("statementDe", text.inGerman(text.statement), true),
    ],
  }[draft.type];

  return (
    <Modal title={editing ? text.editCard : text.createCard} onClose={props.onClose}>
      <div className="modal-body editor-form">
        <Field
          label={text.type}
          control={(aria) => (
            <Select
              {...aria}
              value={draft.type}
              onChange={(event) => set("type", event.target.value as TDraft["type"])}
            >
              {editableTypes.map((type) => (
                <option key={type} value={type}>
                  {text.cardTypes[type]}
                </option>
              ))}
            </Select>
          )}
        />
        {typeFields}
        <Field
          label={text.cardId}
          hint={editing ? undefined : text.cardIdHint}
          error={error("id")}
          control={(aria) => (
            <input
              {...aria}
              className="control"
              value={id}
              disabled={editing}
              onChange={(event) => {
                setIdTyped(true);
                set("id", event.target.value);
              }}
            />
          )}
        />
        {textField("lesson", text.lesson, false)}
        {textField("domainTags", text.domainTags, false, text.tagsHint)}
        {textField("topicTags", text.topicTags, false, text.tagsHint)}
      </div>
      <div className="modal-actions">
        <button className="button ghost" onClick={props.onClose}>
          {text.cancel}
        </button>
        <button className="button primary" onClick={save}>
          {editing ? text.saveChanges : text.createCard}
        </button>
      </div>
    </Modal>
  );
}
