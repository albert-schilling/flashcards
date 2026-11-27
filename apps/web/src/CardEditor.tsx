import type { TCard } from "@flashcards/cards";
import { Plus, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import {
  bothFields,
  cardFromForm,
  editableTypes,
  formFromCard,
  idSource,
  numberFields,
  optionalFields,
  suggestId,
  textFields,
  withoutOption,
  type TCardForm,
  type TChoice,
  type TEditableCard,
  type TEditableType,
  type TFieldErrors,
  type TFieldProblem,
  type TOption,
} from "./card.editor.helper";
import { useText } from "./language.context";
import { Modal } from "./Modal";
import { Select } from "./Select";

type TControlProps = { id: string; "aria-invalid": boolean; "aria-describedby"?: string };

/** `control` gets the props that link the label, hint and error. */
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
    negative: text.allowedErrorNegative,
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

/** Errors show under their fields from the first Save on, not while the Learner types. */
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
    explanation: text.explanation,
    formula: text.formula,
    latex: text.latex,
    unit: text.unit,
    allowedError: text.allowedError,
  };

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
                : optionalFields.has(key)
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
        {typed.type === "multiple_choice" && (
          <OptionRows
            options={typed.options}
            answerIndex={typed.answerIndex}
            errors={errors}
            onChange={(choice) => setTyped({ ...typed, ...choice })}
          />
        )}
        {bothFields[typed.type].map((key) =>
          numberFields.has(key) || key === "unit" ? (
            <Field
              key={key}
              label={labels[key]}
              hint={optionalFields.has(key) ? text.optionalHint : undefined}
              problem={errors[key]}
              control={(controlProps) => (
                <input
                  {...controlProps}
                  className="control"
                  {...(key === "unit" ? { type: "text" } : { type: "number", step: "any" })}
                  value={typed.both[key]}
                  onChange={(event) => setBoth(key, event.target.value)}
                />
              )}
            />
          ) : (
            <TextField
              key={key}
              label={labels[key]}
              hint={optionalFields.has(key) ? text.optionalHint : undefined}
              problem={errors[key]}
              value={typed.both[key]}
              onChange={(value) => setBoth(key, value)}
            />
          ),
        )}
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

/** Remove is disabled at 2 options, the schema's minimum. */
function OptionRows(props: {
  options: TOption[];
  answerIndex: number;
  errors: TFieldErrors;
  onChange: (choice: TChoice) => void;
}) {
  const text = useText();
  const id = useId();
  const hintId = `${id}-hint`;
  const { options, answerIndex } = props;

  function setOption(index: number, language: "en" | "de", value: string) {
    props.onChange({
      options: options.map((option, at) =>
        at === index ? { ...option, [language]: value } : option,
      ),
      answerIndex,
    });
  }

  return (
    <fieldset className="option-rows" aria-describedby={hintId}>
      <legend>{text.options}</legend>
      <small id={hintId}>{text.optionsHint}</small>
      {options.map((option, index) => {
        const n = index + 1;
        return (
          // Keyed by position: options never reorder.
          <div key={index} className="option-row">
            <input
              type="radio"
              name={`${id}-right`}
              aria-label={text.rightOption(n)}
              checked={index === answerIndex}
              onChange={() => props.onChange({ options, answerIndex: index })}
            />
            <div className="option-texts">
              <Field
                label={text.option(n)}
                problem={props.errors[`en.options.${index}`]}
                control={(controlProps) => (
                  <input
                    {...controlProps}
                    className="control"
                    value={option.en}
                    onChange={(event) => setOption(index, "en", event.target.value)}
                  />
                )}
              />
              <Field
                label={text.inGerman(text.option(n))}
                problem={props.errors[`de.options.${index}`]}
                control={(controlProps) => (
                  <input
                    {...controlProps}
                    className="control"
                    value={option.de}
                    onChange={(event) => setOption(index, "de", event.target.value)}
                  />
                )}
              />
            </div>
            <button
              className="icon-button"
              aria-label={text.removeOption(n)}
              title={text.removeOption(n)}
              disabled={options.length <= 2}
              onClick={() => props.onChange(withoutOption({ options, answerIndex }, index))}
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <button
        className="button secondary"
        onClick={() => props.onChange({ options: [...options, { en: "", de: "" }], answerIndex })}
      >
        <Plus size={18} aria-hidden="true" />
        {text.addOption}
      </button>
    </fieldset>
  );
}

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
