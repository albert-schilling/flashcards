import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

/** A native select in the prototype's control style with a ChevronDown over its right end; takes every prop of `select` except `className`, which the style owns. */
export function Select(props: Omit<ComponentProps<"select">, "className">) {
  return (
    <span className="select">
      <select {...props} className="control" />
      <ChevronDown className="select-icon" size={18} aria-hidden="true" />
    </span>
  );
}
