import type { TCard } from "@flashcards/cards";
import { useId, useState, type ReactNode } from "react";
import {
  cardFromForm,
  editableTypes,
  formFromCard,
  suggestId,
  textFields,
  type TCardForm,
  type TEditableCard,
  type TEditableType,
  type TFieldProblem,
  type TFormField,
} from "./card.editor.helper";
import { useText } from "./language.context";
import { Modal } from "./Modal";
import { Select } from "./Select";
import type { TUiText } from "./ui.text";

type TControlProps = { id: string; "aria-invalid": boolean; "aria-describedby"?: string };

/** A label, its control, a hint and the field's error; `control` gets the props that link them. */
function Field(props: {
  label: string;
  hint?: string;
  problem?: TFieldProblem;
  message: (problem: TFieldProblem) => string;
  control: (controlProps: TControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [props.hint && hintId, props.problem && errorId].filter(Boolean).join(" ");
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
          {props.message(props.problem)}
        </small>
      )}
    </div>
  );
}

function problemText(text: TUiText, problem: TFieldProblem): string {
  return {
    empty: text.fieldEmpty,
    noGap: text.needsGap,
    idFormat: text.idFormat,
    idTaken: text.idTaken,
  }[problem];
}

const mainText = { qa: "question", cloze: "text", true_false: "statement" } as const;

/** The Card editor: a Modal titled Create Card or Edit Card, with Type, the type's fields, optional German fields, Domain and Topic tags, Lesson and ID (suggested from the text while the Learner hasn't typed one; disabled when editing). Save checks the form with cardFromForm: errors show under their fields from then on, and a valid Card goes to onSave. Cancel, Close and Escape call onClose. */
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
    : { ...typed, id: suggestId(typed.en[mainText[typed.type]]) };
  const result = cardFromForm(form, { takenIds: props.takenIds, editing: props.card });
  const errors = checked && "errors" in result ? result.errors : {};

  const labels = {
    question: text.question,
    answer: text.answer,
    text: text.text,
    statement: text.statement,
  };

  function setTexts(language: "en" | "de", key: string, value: string) {
    setTyped({ ...typed, [language]: { ...typed[language], [key]: value } });
  }

  function save() {
    if ("card" in result) props.onSave(result.card);
    else setChecked(true);
  }

  const message = (problem: TFieldProblem) => problemText(text, problem);
  const problem = (name: TFormField) => errors[name];

  return (
    <Modal title={props.card ? text.editCard : text.createCard} onClose={props.onClose}>
      <div className="modal-body editor-form">
        <Field
          label={text.type}
          message={message}
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
          <TextFields
            key={key}
            label={labels[key]}
            hint={key === "text" ? text.clozeHint : undefined}
            problem={problem(`en.${key}`)}
            message={message}
            value={typed.en[key]}
            onChange={(value) => setTexts("en", key, value)}
          >
            {typed.type === "true_false" && (
              <Field
                label={text.answer}
                message={message}
                control={(controlProps) => (
                  <Select
                    {...controlProps}
                    value={String(typed.answer)}
                    onChange={(event) =>
                      setTyped({ ...typed, answer: event.target.value === "true" })
                    }
                  >
                    <option value="true">{text.true}</option>
                    <option value="false">{text.false}</option>
                  </Select>
                )}
              />
            )}
          </TextFields>
        ))}
        {textFields[typed.type].map((key) => (
          <TextFields
            key={`de-${key}`}
            label={text.inGerman(labels[key])}
            hint={text.germanHint}
            problem={problem(`de.${key}`)}
            message={message}
            value={typed.de[key]}
            onChange={(value) => setTexts("de", key, value)}
          />
        ))}
        <Field
          label={text.domainTags}
          hint={text.tagsHint}
          problem={problem("tags.domain")}
          message={message}
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
          problem={problem("tags.topic")}
          message={message}
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
          problem={problem("lesson")}
          message={message}
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
          problem={problem("id")}
          message={message}
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

/** A text field as a textarea, with `children` right after it (the true_false Answer follows its Statement). */
function TextFields(props: {
  label: string;
  hint?: string;
  problem?: TFieldProblem;
  message: (problem: TFieldProblem) => string;
  value: string;
  onChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <>
      <Field
        label={props.label}
        hint={props.hint}
        problem={props.problem}
        message={props.message}
        control={(controlProps) => (
          <textarea
            {...controlProps}
            className="control"
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
          />
        )}
      />
      {props.children}
    </>
  );
}
