// Citation verification: every path the model cites is checked against the real
// file tree. Anything that doesn't exist is dropped, which catches hallucinated files.

import type { Citation, ChatStatus } from "@/types";

export interface RawCitation {
  path: string;
  reason?: string;
}

function clean(path: string): string {
  return path
    .trim()
    .replace(/^`|`$/g, "")
    .replace(/^\.?\//, "")
    .replace(/#L\d+(-L?\d+)?$/i, "") // strip line anchors like #L10-L20
    .replace(/:\d+(-\d+)?$/, ""); // strip "file.ts:10-20"
}

export function verifyCitations(
  raw: RawCitation[],
  treePaths: Set<string>,
): { valid: Citation[]; dropped: string[] } {
  const valid: Citation[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();

  for (const c of raw) {
    const path = clean(c.path ?? "");
    if (!path) continue;
    if (treePaths.has(path)) {
      if (!seen.has(path)) {
        seen.add(path);
        valid.push({ path, reason: c.reason?.slice(0, 200) });
      }
    } else {
      dropped.push(c.path);
    }
  }
  return { valid, dropped };
}

export const INSUFFICIENT_EVIDENCE_MESSAGE =
  "Not enough evidence: I couldn't find files in this repository that answer that. Try naming a file, folder or feature, or open the file and ask again.";

/** Decides the final status shown in the UI. */
export function decideStatus(enoughEvidence: boolean, validCount: number): ChatStatus {
  if (!enoughEvidence) return "insufficient_evidence";
  if (validCount === 0) return "unverified";
  return "answered";
}
