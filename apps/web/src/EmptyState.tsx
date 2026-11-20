import { Upload } from "lucide-react";
import { useText } from "./language.context";

/** The compact empty-state notice with its upload icon, for inside a panel: `title` and `hint` default to "No Cards yet" and the upload hint; the caller puts any actions below it. */
export function EmptyState(props: { title?: string; hint?: string }) {
  const text = useText();

  return (
    <div className="empty-state compact">
      <span className="empty-icon">
        <Upload size={24} aria-hidden="true" />
      </span>
      <h3>{props.title ?? text.noCardsYet}</h3>
      <p>{props.hint ?? text.uploadFirstDeck}</p>
    </div>
  );
}
