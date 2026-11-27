import type { TCard } from "@flashcards/cards";
import { useId, useState, type ReactNode } from "react";
import {
  bothFields,
  cardFromForm,
  editableTypes,
  formFromCard,
  idSource,
  suggestId,
  textFields,
  type TCardForm,
  type TEditableCard,
  type TEditableType,
  type TFieldProblem,
} from "./card.editor.helper";
import { useText } from "./language.context";
import { Modal } from "./Modal";
import { Select } from "./Select";

type TControlProps = { id: string; "aria-invalid": boolean; "aria-describedby"?: string };

/** A label, its control, a hint and the field's error; `control` gets the props that link them. */
function Field(props: {
  label: string;
  hint?: string;
  problem?: TFieldProblem;
  control: (controlProps: TControlProps) => ReactNode;
}) {
  const text = useText();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [props.hint && hintId, props.problem && errorId].filter(Boolean).join(" ");
  const problemTexts: Record<TFieldProblem, string> = {
    empty: text.fieldEmpty,
    noGap: text.needsGap,
    idFormat: text.idFormat,
    idTaken: text.idTaken,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      {props.control({
        id,
        "aria-invalid": props.problem !== undefined,
        ...(describedBy && { "aria-describedby": describedBy }),
      })}
      {props.hint && <small id={hintId}>{props.hint}</small>}
      {props.problem && (
        <small id={errorId} className="field-error">
          {problemTexts[props.problem]}
        </small>
      )}
    </div>
  );
}

/** The Card editor: a Modal titled Create Card or Edit Card, with Type, the type's fields (the ones with one value for both languages after the English ones), optional German fields, Domain and Topic tags, Lesson and ID (suggested from the text while the Learner hasn't typed one; disabled when editing). Save checks the form with cardFromForm: errors show under their fields from then on, and a valid Card goes to onSave. Cancel, Close and Escape call onClose. */
export function CardEditor(props: {
  card?: TEditableCard;
  takenIds: string[];
  onSave: (card: TCard) => void;
  onClose: () => void;
}) {
  const text = useText();
  const [typed, setTyped] = useState(() => formFromCard(props.card));
  // An edited Card keeps its ID, so only a new Card's ID follows the text.
  const [idTyped, setIdTyped] = useState(props.card !== undefined);
  const [checked, setChecked] = useState(false);

  const form: TCardForm = idTyped
    ? typed
    : { ...typed, id: suggestId(typed.en[idSource[typed.type]]) };
  const result = cardFromForm(form, { takenIds: props.takenIds, editing: props.card });
  const errors = checked && "errors" in result ? result.errors : {};

  const labels = {
    question: text.question,
    answer: text.answer,
    text: text.text,
    statement: text.statement,
    name: text.name,
    wordFormula: text.wordFormula,
    readAloud: text.readAloud,
    example: text.exampleLabel,
    formula: text.formula,
    latex: text.latex,
  };
  const optionalKeys: string[] = ["readAloud", "example", "latex"];

  function setBoth(key: keyof TCardForm["both"], value: string) {
    setTyped({ ...typed, both: { ...typed.both, [key]: value } });
  }

  function setTexts(language: "en" | "de", key: keyof TCardForm["en"], value: string) {
    setTyped({ ...typed, [language]: { ...typed[language], [key]: value } });
  }

  function save() {
    if ("card" in result) props.onSave(result.card);
    else setChecked(true);
  }

  return (
    <Modal title={props.card ? text.editCard : text.createCard} onClose={props.onClose}>
      <div className="modal-body editor-form">
        <Field
          label={text.type}
          control={(controlProps) => (
            <Select
              {...controlProps}
              value={typed.type}
              onChange={(event) =>
                setTyped({ ...typed, type: event.target.value as TEditableType })
              }
            >
              {editableTypes.map((type) => (
                <option key={type} value={type}>
                  {text.cardTypes[type]}
                </option>
              ))}
            </Select>
          )}
        />
        {textFields[typed.type].map((key) => (
          <TextField
            key={key}
            label={labels[key]}
            hint={
              key === "text"
                ? text.clozeHint
                : optionalKeys.includes(key)
                  ? text.optionalHint
                  : undefined
            }
            problem={errors[`en.${key}`]}
            value={typed.en[key]}
            onChange={(value) => setTexts("en", key, value)}
          />
        ))}
        {typed.type === "true_false" && (
          <Field
            label={text.answer}
            control={(controlProps) => (
              <Select
                {...controlProps}
                value={String(typed.answer)}
                onChange={(event) => setTyped({ ...typed, answer: event.target.value === "true" })}
              >
                <option value="true">{text.true}</option>
                <option value="false">{text.false}</option>
              </Select>
            )}
          />
        )}
        {bothFields[typed.type].map((key) => (
          <TextField
            key={key}
            label={labels[key]}
            hint={optionalKeys.includes(key) ? text.optionalHint : undefined}
            problem={errors[key]}
            value={typed.both[key]}
            onChange={(value) => setBoth(key, value)}
          />
        ))}
        {textFields[typed.type].map((key) => (
          <TextField
            key={`de-${key}`}
            label={text.inGerman(labels[key])}
            hint={text.germanHint}
            problem={errors[`de.${key}`]}
            value={typed.de[key]}
            onChange={(value) => setTexts("de", key, value)}
          />
        ))}
        <Field
          label={text.domainTags}
          hint={text.tagsHint}
          problem={errors["tags.domain"]}
          control={(controlProps) => (
            <input
              {...controlProps}
              className="control"
              value={typed.domainTags}
              placeholder={text.domainTagsPlaceholder}
              onChange={(event) => setTyped({ ...typed, domainTags: event.target.value })}
            />
          )}
        />
        <Field
          label={text.topicTags}
          hint={text.tagsHint}
          problem={errors["tags.topic"]}
          control={(controlProps) => (
            <input
              {...controlProps}
              className="control"
              value={typed.topicTags}
              placeholder={text.topicTagsPlaceholder}
              onChange={(event) => setTyped({ ...typed, topicTags: event.target.value })}
            />
          )}
        />
        <Field
          label={text.lesson}
          problem={errors.lesson}
          control={(controlProps) => (
            <input
              {...controlProps}
              className="control"
              value={typed.lesson}
              onChange={(event) => setTyped({ ...typed, lesson: event.target.value })}
            />
          )}
        />
        <Field
          label={text.cardId}
          hint={text.idHint}
          problem={errors.id}
          control={(controlProps) => (
            <input
              {...controlProps}
              className="control"
              value={form.id}
              disabled={props.card !== undefined}
              onChange={(event) => {
                setIdTyped(true);
                setTyped({ ...typed, id: event.target.value });
              }}
            />
          )}
        />
      </div>
      <div className="modal-actions">
        <button className="button ghost" onClick={props.onClose}>
          {text.cancel}
        </button>
        <button className="button primary" onClick={save}>
          {props.card ? text.saveChanges : text.createCard}
        </button>
      </div>
    </Modal>
  );
}

/** A text field as a textarea. */
function TextField(props: {
  label: string;
  hint?: string;
  problem?: TFieldProblem;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      label={props.label}
      hint={props.hint}
      problem={props.problem}
      control={(controlProps) => (
        <textarea
          {...controlProps}
          className="control"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
    />
  );
}
