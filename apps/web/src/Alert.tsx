import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";

export type TAlertTone = "success" | "danger" | "info";

const icons = { success: CircleCheck, danger: CircleAlert, info: Info };

/** A message in the prototype's alert style with its tone's icon; give `role="alert"` only to messages that must interrupt, such as errors. */
export function Alert(props: { tone: TAlertTone; role?: "alert"; children: ReactNode }) {
  const Icon = icons[props.tone];
  return (
    <div className={`alert ${props.tone}`} role={props.role}>
      <Icon aria-hidden="true" />
      <div>{props.children}</div>
    </div>
  );
}
