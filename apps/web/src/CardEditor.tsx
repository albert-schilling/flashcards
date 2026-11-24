import type { TCard } from "@flashcards/cards";
import { useId, useState, type ReactNode } from "react";
import {
  buildCard,
  editorTypes,
  fieldsFromCard,
  suggestId,
  type TEditorFields,
  type TFieldError,
  type TFieldErrors,
} from "./card.editor";
import { useText } from "./language.context";
import { Modal } from "./Modal";
import { Select } from "./Select";

type TControlProps = { "aria-invalid"?: true; "aria-describedby"?: string };

/** A label around its control, an optional hint and, once the field is wrong, its error. `children` gets the props that link the control to the error. */
function Field(props: {
  label: string;
  error?: TFieldError;
  hint?: string;
  children: (control: TControlProps) => ReactNode;
}) {
  const text = useText();
  const errorId = useId();
  const control: TControlProps = props.error
    ? { "aria-invalid": true, "aria-describedby": errorId }
    : {};
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children(control)}
      {props.hint && <small>{props.hint}</small>}
      {props.error && (
        <small id={errorId} className="field-error">
          {text.fieldErrors[props.error]}
        </small>
      )}
    </label>
  );
}

/** The text the ID is suggested from: the Card's question, text or statement. */
function idSource(fields: TEditorFields): string {
  return { qa: fields.question, cloze: fields.text, true_false: fields.statement }[fields.type];
}

/** The Card editor, a Modal that creates a Card or, with `card`, edits it. The fields depend on the Type (qa, cloze or true_false); each has an optional German field. While the Learner hasn't typed in the ID field, the ID follows the question, text or statement (see suggestId). An editing Learner can't change the ID or the Type, since a new ID is another Card and a new type drops the fields. Save stays enabled and checks the fields with buildCard against `cards`: it shows each field's error and saves nothing, or calls onSave with the Card. The caller closes the editor. */
export function CardEditor(props: {
  card?: TCard;
  cards: TCard[];
  onSave: (card: TCard) => void;
  onClose: () => void;
}) {
  const text = useText();
  const [fields, setFields] = useState(() => fieldsFromCard(props.card));
  const [idTyped, setIdTyped] = useState(false);
  const [errors, setErrors] = useState<TFieldErrors>({});
  const editing = props.card !== undefined;

  function change(changes: Partial<TEditorFields>) {
    const next = { ...fields, ...changes };
    // The suggestion follows the source text until the Learner types an ID.
    if (!editing && !idTyped && !("id" in changes)) next.id = suggestId(idSource(next));
    setFields(next);
  }

  function save() {
    const result = buildCard(fields, props.cards, props.card);
    if ("card" in result) props.onSave(result.card);
    else setErrors(result.errors);
  }

  function input(name: keyof TEditorFields, label: string, hint?: string, area = false) {
    const Control = area ? "textarea" : "input";
    return (
      <Field label={label} hint={hint} error={errors[name]}>
        {(control) => (
          <Control
            className="control"
            value={fields[name]}
            onChange={(event) => change({ [name]: event.target.value })}
            {...control}
          />
        )}
      </Field>
    );
  }

  const german = (name: keyof TEditorFields, label: string) =>
    input(name, text.inGerman(label), undefined, true);

  return (
    <Modal title={editing ? text.editCard : text.createCard} onClose={props.onClose}>
      <div className="modal-body editor-form">
        <Field label={text.type}>
          {() => (
            <Select
              value={fields.type}
              disabled={editing}
              onChange={(event) => change({ type: event.target.value as TEditorFields["type"] })}
            >
              {editorTypes.map((type) => (
                <option key={type} value={type}>
                  {text.cardTypes[type]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {fields.type === "qa" && (
          <>
            {input("question", text.question, undefined, true)}
            {input("answer", text.answer, undefined, true)}
            {german("deQuestion", text.question)}
            {german("deAnswer", text.answer)}
          </>
        )}
        {fields.type === "cloze" && (
          <>
            {input("text", text.text, text.gapHint, true)}
            {german("deText", text.text)}
          </>
        )}
        {fields.type === "true_false" && (
          <>
            {input("statement", text.statement, undefined, true)}
            <Field label={text.answer} error={errors.truth}>
              {(control) => (
                <Select
                  value={fields.truth}
                  onChange={(event) => change({ truth: event.target.value as "true" | "false" })}
                  {...control}
                >
                  <option value="true">{text.true}</option>
                  <option value="false">{text.false}</option>
                </Select>
              )}
            </Field>
            {german("deStatement", text.statement)}
          </>
        )}
        <Field label={text.cardId} error={errors.id}>
          {(control) => (
            <input
              className="control"
              value={fields.id}
              disabled={editing}
              onChange={(event) => {
                setIdTyped(true);
                change({ id: event.target.value });
              }}
              {...control}
            />
          )}
        </Field>
        {input("lesson", text.lesson)}
        {input("domain", text.domainTags, text.tagsHint)}
        {input("topic", text.topicTags, text.tagsHint)}
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
