import { z } from "zod";
import type { TFileError } from "./deck";
import { downloadFile } from "./download.helper";
import { addNewReviews, loadReviews, saveLastDownload, type TReview } from "./storage";

export const ZReview: z.ZodType<TReview> = z.strictObject({
  cardId: z.string().min(1),
  cardVersion: z.int().min(1),
  answeredAt: z.iso.datetime(),
  right: z.boolean(),
  durationMs: z.int().min(0),
});

/** A Review log file: every Review of the Learner. */
export const ZReviewLog = z.strictObject({ reviews: z.array(ZReview) });

/** What a Review log upload did: a file that is not a valid Review log stores nothing, otherwise the Reviews not stored yet are added. */
export type TReviewLogReport =
  | { ok: false; errors: TFileError[] }
  | { ok: true; added: number; skipped: number };

function readErrors(error: z.ZodError): TFileError[] {
  return error.issues.map((issue) => {
    const [first, index, ...rest] = issue.path;
    if (first !== "reviews" || typeof index !== "number") return { message: issue.message };
    return {
      where: `review ${index + 1}`,
      ...(rest.length > 0 && { field: rest.join(".") }),
      message: issue.message,
    };
  });
}

/** Reads a Review log file and adds its Reviews to the Review log, skipping those already stored. */
export async function uploadReviewLog(text: string): Promise<TReviewLogReport> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [{ message: error instanceof Error ? error.message : "Not JSON" }],
    };
  }
  const result = ZReviewLog.safeParse(raw);
  if (!result.success) return { ok: false, errors: readErrors(result.error) };

  const added = await addNewReviews(result.data.reviews);
  return { ok: true, added, skipped: result.data.reviews.length - added };
}

/** Downloads every Review as a Review log file and saves now as the last download; returns that time. */
export async function downloadReviewLog(): Promise<string> {
  downloadFile("review-log.json", JSON.stringify({ reviews: await loadReviews() }, null, 2));
  const now = new Date().toISOString();
  await saveLastDownload(now);
  return now;
}
