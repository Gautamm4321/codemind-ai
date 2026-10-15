// Code-quality review: schema + verification of the model's line references.
// Same idea as citation verification: anything the model points at must really exist.

import { z } from "zod";

export const SEVERITIES = ["high", "medium", "low"] as const;

export const reviewSchema = z.object({
  summary: z.string().min(1).max(800),
  issues: z
    .array(
      z.object({
        severity: z.enum(SEVERITIES),
        category: z.string().max(40),
        title: z.string().min(1).max(140),
        detail: z.string().max(800),
        line: z.number().int().nullable().optional(),
      }),
    )
    .max(10),
});

export type RawReview = z.infer<typeof reviewSchema>;

export interface ReviewIssue {
  severity: (typeof SEVERITIES)[number];
  category: string;
  title: string;
  detail: string;
  line: number | null;
}

/**
 * Keeps line numbers only if they point inside the part of the file the model actually saw.
 * Sorts high → low severity, then by line.
 */
export function sanitizeIssues(issues: RawReview["issues"], maxLine: number): { issues: ReviewIssue[]; droppedLines: number } {
  let droppedLines = 0;
  const order = { high: 0, medium: 1, low: 2 };
  const out = issues.map((i) => {
    let line = i.line ?? null;
    if (line !== null && (line < 1 || line > maxLine)) {
      droppedLines++;
      line = null;
    }
    return { severity: i.severity, category: i.category.trim() || "general", title: i.title.trim(), detail: i.detail.trim(), line };
  });
  out.sort((a, b) => order[a.severity] - order[b.severity] || (a.line ?? 1e9) - (b.line ?? 1e9));
  return { issues: out, droppedLines };
}
