import { ArrowRight, ChartColumn, Plus, RotateCcw, Upload } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { useText } from "./language.context";
import { PageHeading } from "./PageHeading";
import { Select } from "./Select";

/** Home's top: the welcome heading, then the Start a Session panel and a link to the Cards page, or, with no Cards, the empty state. App owns Cards and Tag and starts the Session; Upload Deck and the link call onCards, which opens the Cards page and its Files panel; Create Card does too until the Card editor exists. */
export function Home(props: {
  cardCount: number;
  size: number;
  onSize: (size: number) => void;
  tags: string[];
  tag: string;
  onTag: (tag: string) => void;
  canStart: boolean;
  onStart: () => void;
  onStatistics: () => void;
  onCards: () => void;
}) {
  const text = useText();

  return (
    <>
      <PageHeading eyebrow={text.welcomeBack} title="Flashcards" intro={text.homeIntro} />
      {props.cardCount === 0 ? (
        <section className="panel home-empty">
          <EmptyState />
          <div className="empty-actions">
            <button className="button primary" onClick={props.onCards}>
              <Upload size={18} aria-hidden="true" />
              {text.uploadDeck}
            </button>
            <button className="button secondary" onClick={props.onCards}>
              <Plus size={18} aria-hidden="true" />
              {text.createCard}
            </button>
          </div>
        </section>
      ) : (
        <div className="home-focus">
          <section className="panel">
            <div className="section-heading">
              <span className="section-icon">
                <RotateCcw size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">{text.studyToday}</p>
                <h2>{text.startASession}</h2>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                {text.cards}
                <input
                  className="control"
                  type="number"
                  value={props.size}
                  onChange={(event) => props.onSize(event.target.valueAsNumber)}
                />
              </label>
              <label className="field">
                {text.tag}
                <Select value={props.tag} onChange={(event) => props.onTag(event.target.value)}>
                  <option value="">{text.anyTag}</option>
                  {props.tags.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </Select>
              </label>
            </div>
            <button
              className="button primary large full"
              disabled={!props.canStart}
              onClick={props.onStart}
            >
              {text.startSession}
              <ArrowRight size={19} aria-hidden="true" />
            </button>
            <button className="button secondary full" onClick={props.onStatistics}>
              <ChartColumn size={18} aria-hidden="true" />
              {text.statistics}
            </button>
          </section>
          <button className="home-library-link" onClick={props.onCards}>
            <span>
              <strong>{text.cardCount(props.cardCount)}</strong>
              <small>{text.manageLibrary}</small>
            </span>
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
