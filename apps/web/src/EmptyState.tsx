import { Upload } from "lucide-react";
import { useText } from "./language.context";

/** The compact "No Cards yet" notice with its upload icon and hint, for inside a panel; the caller puts any actions below it. */
export function EmptyState() {
  const text = useText();

  return (
    <div className="empty-state compact">
      <span className="empty-icon">
        <Upload size={24} aria-hidden="true" />
      </span>
      <h3>{text.noCardsYet}</h3>
      <p>{text.uploadFirstDeck}</p>
    </div>
  );
}
