import type { TCard } from "@flashcards/cards";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  checkForm,
  emptyForm,
  formFromCard,
  suggestId,
  type TEditorError,
  type TEditorField,
  type TEditorForm,
} from "./card.editor.helper";
import { useText } from "./language.context";
import { Modal } from "./Modal";
import { Select } from "./Select";
import type { TUiText } from "./ui.text";

type TType = TEditorForm["type"];
type TTextField = keyof TEditorForm["de"];

const types: TType[] = ["qa", "cloze", "true_false"];

/** The text fields each type has, in the order they show. */
const fieldsOf: Record<TType, TTextField[]> = {
  qa: ["question", "answer"],
  cloze: ["text"],
  true_false: ["statement"],
};

/** The field that the suggested ID follows. */
const idSource: Record<TType, TTextField> = {
  qa: "question",
  cloze: "text",
  true_false: "statement",
};

function labelOf(field: TTextField, text: TUiText): string {
  return {
    question: text.question,
    answer: text.answer,
    text: text.clozeText,
    statement: text.statement,
  }[field];
}

/** The attributes that tie a control to its error. */
type TControlProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
};

/** A label with a control, its hint and, once there is one, its error text. `children` gets the attributes for the control. */
function Field(props: {
  label: string;
  hint?: string;
  error?: string;
  children: (control: TControlProps) => ReactNode;
}) {
  const controlId = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy = props.error ? errorId : props.hint ? hintId : undefined;
  return (
    <div className="field">
      <label htmlFor={controlId}>{props.label}</label>
      {props.children({
        id: controlId,
        "aria-invalid": Boolean(props.error),
        "aria-describedby": describedBy,
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

/** The Card editor: a Modal, "Create Card" or "Edit Card" by `card`, with the Type select (read-only when editing), the fields of the type, the German fields, Domain and Topic tags, Lesson and ID, Cancel and "Create Card" / "Save changes". A field error shows under its field and the first one gets focus; a valid form calls `onSave`; the editor closes itself only when `onSave` resolves true. Without `card` the ID follows the text until the Learner edits it; with `card` it is read-only. */
export function CardEditor(props: {
  card?: TCard;
  storedIds: string[];
  onSave: (card: TCard) => Promise<boolean>;
  onClose: () => void;
}) {
  const text = useText();
  const [form, setForm] = useState(() => (props.card ? formFromCard(props.card) : emptyForm()));
  const [errors, setErrors] = useState<Partial<Record<TEditorField, TEditorError>>>({});
  const [idEdited, setIdEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  // Counts failed checks, so the first invalid field gets focus after each one.
  const [failures, setFailures] = useState(0);
  const body = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (failures > 0) body.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [failures]);

  const editing = props.card !== undefined;

  function change(field: TEditorField, value: string) {
    setErrors(({ [field]: _gone, ...rest }) => rest);
    setForm((current) => {
      const next = field.startsWith("de.")
        ? { ...current, de: { ...current.de, [field.slice(3)]: value } }
        : { ...current, [field]: value };
      const follows = !editing && !idEdited && field === idSource[current.type];
      return follows ? { ...next, id: suggestId(value, props.storedIds) } : next;
    });
  }

  function changeType(type: TType) {
    setErrors({});
    setForm((current) => {
      // True/False keeps "true" or "false" in `answer`; the other types keep free text there.
      const isChoice = current.answer === "true" || current.answer === "false";
      const answer =
        type === "true_false"
          ? isChoice
            ? current.answer
            : "true"
          : isChoice
            ? ""
            : current.answer;
      return { ...current, type, answer };
    });
  }

  async function submit() {
    const result = checkForm(form, props.storedIds, props.card);
    if ("errors" in result) {
      setErrors(result.errors);
      setFailures((count) => count + 1);
      return;
    }
    setSaving(true);
    const saved = await props.onSave(result.card);
    setSaving(false);
    if (saved) props.onClose();
  }

  const message = (field: TEditorField) => {
    const error = errors[field];
    return error === undefined ? undefined : text[error];
  };

  function textControl(
    field: TTextField,
    value: string,
    onChange: (value: string) => void,
    control: TControlProps,
  ) {
    const attributes = {
      ...control,
      className: "control",
      value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    };
    // A statement is one line; the other texts can be long.
    return field === "statement" ? <input {...attributes} /> : <textarea {...attributes} />;
  }

  return (
    <Modal title={editing ? text.editCard : text.createCard} onClose={props.onClose}>
      <form
        ref={body}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="modal-body editor-form">
          <Field label={text.type}>
            {(control) => (
              <Select
                id={control.id}
                value={form.type}
                disabled={editing}
                onChange={(event) => changeType(event.target.value as TType)}
              >
                {types.map((type) => (
                  <option key={type} value={type}>
                    {text.cardTypes[type]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {fieldsOf[form.type].map((field) => (
            <Field
              key={field}
              label={labelOf(field, text)}
              hint={field === "text" ? text.clozeHint : undefined}
              error={message(field)}
            >
              {(control) =>
                textControl(field, form[field], (value) => change(field, value), control)
              }
            </Field>
          ))}
          {form.type === "true_false" && (
            <Field label={text.answer}>
              {(control) => (
                <Select
                  id={control.id}
                  value={form.answer}
                  onChange={(event) => change("answer", event.target.value)}
                >
                  <option value="true">{text.true}</option>
                  <option value="false">{text.false}</option>
                </Select>
              )}
            </Field>
          )}
          <fieldset className="editor-german">
            <legend>{text.germanOptional}</legend>
            {fieldsOf[form.type].map((field) => (
              <Field key={field} label={labelOf(field, text)} error={message(`de.${field}`)}>
                {(control) =>
                  textControl(
                    field,
                    form.de[field],
                    (value) => change(`de.${field}`, value),
                    control,
                  )
                }
              </Field>
            ))}
          </fieldset>
          <Field label={text.domainTags} hint={text.tagsHint} error={message("domain")}>
            {(control) => (
              <input
                {...control}
                className="control"
                value={form.domain}
                onChange={(event) => change("domain", event.target.value)}
              />
            )}
          </Field>
          <Field label={text.topicTags} hint={text.tagsHint} error={message("topic")}>
            {(control) => (
              <input
                {...control}
                className="control"
                value={form.topic}
                onChange={(event) => change("topic", event.target.value)}
              />
            )}
          </Field>
          <Field label={text.lesson} error={message("lesson")}>
            {(control) => (
              <input
                {...control}
                className="control"
                value={form.lesson}
                onChange={(event) => change("lesson", event.target.value)}
              />
            )}
          </Field>
          <Field label={text.id} error={message("id")}>
            {(control) => (
              <input
                {...control}
                className="control"
                value={form.id}
                readOnly={editing}
                onChange={(event) => {
                  setIdEdited(true);
                  change("id", event.target.value);
                }}
              />
            )}
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="button ghost" onClick={props.onClose}>
            {text.cancel}
          </button>
          <button type="submit" className="button primary" disabled={saving}>
            {editing ? text.saveChanges : text.createCard}
          </button>
        </div>
      </form>
    </Modal>
  );
}
