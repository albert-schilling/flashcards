import { ZCard, type TCard } from "@flashcards/cards";
import { Plus, Search, Trash2 } from "lucide-react";
import { useContext, useState, type ReactNode } from "react";
import { Alert } from "./Alert";
import { CardEditor } from "./CardEditor";
import { CardList } from "./CardList";
import { CardPreview } from "./CardPreview";
import { cardTitle } from "./CardView";
import { isEditable } from "./editor.helper";
import { EmptyState } from "./EmptyState";
import { LanguageContext, useText, type TLanguage } from "./language.context";
import { Modal } from "./Modal";
import { PageHeading } from "./PageHeading";
import { Select } from "./Select";
import { allTags } from "./session.helper";

const cardTypes = ZCard.options.map((option) => option.shape.type.value);

/** Whether the Card matches the search and filters: `query` (trimmed, any case) is in its title as shown in `language`, its ID or one of its tags; `type` and `tag` must match exactly, and "" means any. */
function matches(
  card: TCard,
  query: string,
  type: string,
  tag: string,
  language: TLanguage,
): boolean {
  const tags = [...card.tags.domain, ...card.tags.topic];
  if (type !== "" && card.type !== type) return false;
  if (tag !== "" && !tags.includes(tag)) return false;
  const needle = query.trim().toLowerCase();
  return [cardTitle(card, language), card.id, ...tags].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

/** The Cards page: the Library heading, then a panel with a search and Type and Tag filters, the "N of M Cards" count, the windowed Card list (see CardList) and Delete all, which asks in a modal first and closes it before deleting. A row opens the Card preview (see CardPreview); a row's Delete asks in a modal first. Create Card, and Edit in the preview, open the Card editor (see CardEditor), open from the start with `creating`; a saved Card shows in its preview. A deleted or saved Card shows a dismissible "Card deleted." or "Card saved." notice above the panel until the Learner leaves the page; a failed delete or save hides it. The filters reset when the Learner leaves the page. With no Cards the panel shows the empty state; with Cards but no match, a "No matching Cards" notice. Delete all counts and deletes every Card, shown or not. `children` is the second column, beside the list on desktop; App passes the Files panel. App owns the Cards and does the deleting and saving. */
export function CardsPage(props: {
  cards: TCard[];
  onDelete: (id: string) => Promise<boolean>;
  onDeleteAll: () => void;
  onSave: (card: TCard) => Promise<boolean>;
  creating?: boolean;
  children?: ReactNode;
}) {
  const text = useText();
  const language = useContext(LanguageContext);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // IDs, not Cards: a modal closes by itself once its Card is gone.
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // The ID of the Card being edited, "new" while creating one.
  const [editorId, setEditorId] = useState<string | null>(props.creating ? "new" : null);
  const [notice, setNotice] = useState<"deleted" | "saved" | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [pickedTag, setPickedTag] = useState("");
  const tags = allTags(props.cards);
  // A tag that no Card has any more is dropped, so the list is not left empty by a filter the Learner can't see.
  const tag = tags.includes(pickedTag) ? pickedTag : "";
  const shown = props.cards.filter((card) => matches(card, query, type, tag, language));

  const openCard = props.cards.find((card) => card.id === openId);
  const confirmingCard = props.cards.find((card) => card.id === confirmingId);
  const editedCard = props.cards.find((card) => card.id === editorId);
  // Only qa, cloze and true_false Cards have an editor yet.
  const editable = editedCard && isEditable(editedCard) ? editedCard : undefined;

  async function deleteOne(id: string) {
    // Close first, so a failure shows in the page's error and not behind the modal.
    setOpenId(null);
    setConfirmingId(null);
    // A failure hides an earlier notice, so only the error shows.
    setNotice((await props.onDelete(id)) ? "deleted" : null);
  }

  async function save(card: TCard) {
    // Close first, so a failure shows in the page's error and not behind the modal.
    setEditorId(null);
    const saved = await props.onSave(card);
    setNotice(saved ? "saved" : null);
    if (saved) setOpenId(card.id);
  }

  function deleteAll() {
    // Close first, so a failure shows in the page's error and not behind the modal.
    setConfirmingDelete(false);
    props.onDeleteAll();
  }

  return (
    <>
      <div className="cards-page-heading">
        <PageHeading eyebrow={text.library} title={text.cards} intro={text.cardsIntro} />
        <button className="button primary" onClick={() => setEditorId("new")}>
          <Plus size={18} aria-hidden="true" />
          {text.createCard}
        </button>
      </div>
      {notice && (
        <Alert
          tone="success"
          role="status"
          className="library-notice"
          onDismiss={() => setNotice(null)}
        >
          <strong>{notice === "saved" ? text.cardSaved : text.cardDeleted}</strong>
        </Alert>
      )}
      <div className="cards-layout">
        <section className="panel library-panel">
          <div className="library-toolbar">
            <label className="field search-field">
              {text.searchCards}
              <span className="search-input">
                <Search size={18} aria-hidden="true" />
                <input
                  className="control"
                  type="search"
                  value={query}
                  placeholder={text.searchPlaceholder}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </span>
            </label>
            <label className="field">
              {text.type}
              <Select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="">{text.allTypes}</option>
                {cardTypes.map((cardType) => (
                  <option key={cardType} value={cardType}>
                    {text.cardTypes[cardType]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              {text.tag}
              <Select value={tag} onChange={(event) => setPickedTag(event.target.value)}>
                <option value="">{text.anyTag}</option>
                {tags.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </Select>
            </label>
          </div>
          <div className="library-summary">
            <span>{text.cardCountOf(shown.length, props.cards.length)}</span>
          </div>
          {props.cards.length === 0 ? (
            <EmptyState />
          ) : shown.length === 0 ? (
            <EmptyState title={text.noMatchingCards} hint={text.tryAnotherFilter} />
          ) : (
            <CardList
              key={JSON.stringify([query, type, tag])}
              cards={shown}
              onOpen={setOpenId}
              onDelete={setConfirmingId}
            />
          )}
          <button
            className="text-button danger-text delete-all-button"
            disabled={props.cards.length === 0}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={17} aria-hidden="true" />
            {text.deleteAllCards}
          </button>
        </section>
        {props.children}
      </div>
      {openCard && (
        <CardPreview
          card={openCard}
          onClose={() => setOpenId(null)}
          onDelete={() => void deleteOne(openCard.id)}
          onEdit={
            isEditable(openCard)
              ? () => {
                  setOpenId(null);
                  setEditorId(openCard.id);
                }
              : undefined
          }
        />
      )}
      {(editorId === "new" || editable) && (
        <CardEditor
          card={editable}
          takenIds={props.cards.map((card) => card.id)}
          onSave={(card) => void save(card)}
          onClose={() => setEditorId(null)}
        />
      )}
      {confirmingCard && (
        <Modal title={text.deleteCardTitle} onClose={() => setConfirmingId(null)}>
          <div className="modal-body">
            <Alert tone="danger">
              <strong>{text.cannotBeUndone}</strong>
              <p>{text.deleteCardWarning(confirmingCard.id)}</p>
            </Alert>
          </div>
          <div className="modal-actions">
            <button className="button ghost" onClick={() => setConfirmingId(null)}>
              {text.cancel}
            </button>
            <button className="button danger" onClick={() => void deleteOne(confirmingCard.id)}>
              {text.delete}
            </button>
          </div>
        </Modal>
      )}
      {confirmingDelete && (
        <Modal title={text.deleteAllCardsTitle} onClose={() => setConfirmingDelete(false)}>
          <div className="modal-body">
            <Alert tone="danger">
              <strong>{text.cannotBeUndone}</strong>
              <p>{text.deleteAllWarning(props.cards.length)}</p>
            </Alert>
          </div>
          <div className="modal-actions">
            <button className="button ghost" onClick={() => setConfirmingDelete(false)}>
              {text.cancel}
            </button>
            <button className="button danger" onClick={deleteAll}>
              {text.deleteAllCards}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
