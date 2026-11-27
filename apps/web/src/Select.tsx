import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

/** Takes every prop of `select` except `className`, which the style owns. */
export function Select(props: Omit<ComponentProps<"select">, "className">) {
  return (
    <span className="select">
      <select {...props} className="control" />
      <ChevronDown className="select-icon" size={18} aria-hidden="true" />
    </span>
  );
}
