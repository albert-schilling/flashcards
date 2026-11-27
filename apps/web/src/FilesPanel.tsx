import { CircleCheck, Download, FileJson, TriangleAlert } from "lucide-react";
import type { ChangeEvent } from "react";
import type { TUploadReport } from "./deck";
import type { TReviewLogReport } from "./review.log";
import { Alert } from "./Alert";
import { FileButton } from "./FileButton";
import { useText } from "./language.context";
import type { TUiText } from "./ui.text";

const DAY_MS = 24 * 60 * 60 * 1000;
// The backup note stays in success style for a week, then asks for a new download.
const SAFE_DAYS = 7;

function summary(
  report: Extract<TUploadReport | TReviewLogReport, { ok: true }>,
  text: TUiText,
): string {
  return "skipped" in report
    ? text.reviewLogSummary(report.added, report.skipped)
    : text.deckSummary(report.added, report.updated, report.unchanged);
}

export function FilesPanel(props: {
  report?: TUploadReport | TReviewLogReport;
  lastDownload?: string;
  onUploadDeck: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadReviewLog: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadCards: () => void;
  onDownloadReviewLog: () => void;
}) {
  const text = useText();
  const { report, lastDownload } = props;
  const days =
    lastDownload === undefined
      ? undefined
      : Math.floor((Date.now() - Date.parse(lastDownload)) / DAY_MS);
  const stale = days === undefined || days > SAFE_DAYS;
  const NoteIcon = stale ? TriangleAlert : CircleCheck;

  return (
    <aside className="panel backup-panel">
      <div className="section-heading compact">
        <span className="section-icon neutral">
          <FileJson size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{text.backup}</p>
          <h2>{text.files}</h2>
        </div>
      </div>
      <div className="file-grid single-column">
        <FileButton
          label={text.uploadDeck}
          accept=".json,application/json"
          onChange={props.onUploadDeck}
        />
        <FileButton
          label={text.uploadReviewLog}
          accept=".json,application/json"
          onChange={props.onUploadReviewLog}
        />
        <button className="button ghost" onClick={props.onDownloadCards}>
          <Download size={18} aria-hidden="true" />
          {text.downloadCards}
        </button>
        <button className="button ghost" onClick={props.onDownloadReviewLog}>
          <Download size={18} aria-hidden="true" />
          {text.downloadReviewLog}
        </button>
      </div>
      <p className={stale ? "backup-note warning" : "backup-note"}>
        <NoteIcon size={17} aria-hidden="true" />
        {days === undefined ? text.noDownloadYet : text.daysSinceDownload(days)}
      </p>
      {report && (
        <Alert tone={report.ok ? "success" : "danger"}>
          <strong>{report.ok ? text.uploadResult : text.fileRejected}</strong>
          {report.ok && <p>{summary(report, text)}</p>}
          <ul>
            {("errors" in report ? report.errors : []).map((fileError, i) => (
              <li key={i}>
                {[fileError.where, fileError.field, fileError.message].filter(Boolean).join(": ")}
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </aside>
  );
}
