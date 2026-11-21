import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { useText } from "./language.context";

export type TAlertTone = "success" | "danger" | "info";

const icons = { success: CircleCheck, danger: CircleAlert, info: Info };

/** A message in the prototype's alert style with its tone's icon; give `role="alert"` only to messages that must interrupt, such as errors, and `role="status"` to notices. With onDismiss, an X (Dismiss) at the top right calls it. */
export function Alert(props: {
  tone: TAlertTone;
  role?: "alert" | "status";
  className?: string;
  onDismiss?: () => void;
  children: ReactNode;
}) {
  const text = useText();
  const Icon = icons[props.tone];
  return (
    <div
      className={`alert ${props.tone}${props.className ? ` ${props.className}` : ""}`}
      role={props.role}
    >
      <Icon size={20} aria-hidden="true" />
      <div>{props.children}</div>
      {props.onDismiss && (
        <button className="alert-close" onClick={props.onDismiss} aria-label={text.dismiss}>
          <X size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
