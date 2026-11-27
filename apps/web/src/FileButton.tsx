import { Upload } from "lucide-react";
import type { ChangeEvent } from "react";

/** The label text names the visually hidden file input. */
export function FileButton(props: {
  label: string;
  accept: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="button secondary file-button">
      <Upload size={18} aria-hidden="true" />
      {props.label}
      <input type="file" accept={props.accept} onChange={props.onChange} />
    </label>
  );
}
