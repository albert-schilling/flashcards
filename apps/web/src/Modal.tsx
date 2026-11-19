import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useText } from "./language.context";

/** A dialog over a dimmed backdrop, titled `title`, with the caller's body and actions as children; render it only while open. Close (X), Escape and a mouse-down on the backdrop call onClose; a mouse-down inside doesn't, so a drag that ends outside keeps it open. Focus moves into the dialog when it opens. */
export function Modal(props: { title: string; onClose: () => void; children: ReactNode }) {
  const text = useText();
  const titleId = useId();
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && props.onClose()}
      >
        <div className="modal-header">
          <h2 id={titleId}>{props.title}</h2>
          <button className="icon-button" onClick={props.onClose} aria-label={text.close}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {props.children}
      </section>
    </div>
  );
}
