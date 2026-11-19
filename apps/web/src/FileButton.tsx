import { Upload } from "lucide-react";
import type { ChangeEvent } from "react";

/** A label styled as a secondary button, with an Upload icon, around a visually hidden file input; the label text names the input. */
export function FileButton(props: {
  label: string;
  accept: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="button secondary file-button">
      <Upload aria-hidden="true" />
      {props.label}
      <input type="file" accept={props.accept} onChange={props.onChange} />
    </label>
  );
}
