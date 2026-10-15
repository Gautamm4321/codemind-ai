import { NextResponse } from "next/server";
import { completeJSON, UNTRUSTED_CONTENT_RULE } from "@/lib/ai";
import { errorResponse } from "@/lib/errors";
import { LIMITS } from "@/lib/file-filter";
import { assertInTree, getFileContent, getTree } from "@/lib/github";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { reviewSchema, sanitizeIssues } from "@/lib/review";
import { withLineNumbers } from "@/lib/truncate";
import { fileRequestSchema } from "@/lib/validation";
import type { CodeReview } from "@/types";

export const maxDuration = 30;

/** POST /api/review  { owner, name, ref, path } -> code-quality suggestions with verified line numbers */
export async function POST(req: Request) {
  try {
    enforceAiRateLimit(req);
    const { owner, name, ref, path } = fileRequestSchema.parse(await req.json().catch(() => ({})));
    const id = { owner, name };
    const tree = await getTree(id, ref);
    const entry = assertInTree(tree.files, path);
    const file = await getFileContent(id, ref, entry.path, entry.size);

    const numbered = withLineNumbers(file.content, LIMITS.maxReviewChars);

    const result = await completeJSON(
      [
        {
          role: "system",
          content: `You are CodeMind, a pragmatic senior reviewer. Review ONE file for real, actionable problems.
${UNTRUSTED_CONTENT_RULE}
Each line of the file is prefixed with its line number like "12| code". Respond with ONLY a JSON object:
{
  "summary": "2-3 sentences: overall quality and the most important theme",
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "category": "bug | security | performance | readability | maintainability | accessibility | best-practice",
      "title": "short, specific title",
      "detail": "what is wrong, why it matters, and how to fix it (may include a short code snippet)",
      "line": 12
    }
  ]
}
Rules:
- At most 8 issues, most important first. Skip trivial style nits.
- "line" must be a line number you can see, or null if the issue is not tied to one line.
- Only report what is visible in the code. If the code looks good, return few or no issues and say so.`,
        },
        {
          role: "user",
          content: `Repository: ${owner}/${name}
${numbered.truncated ? `NOTE: Only lines 1-${numbered.lastLine} of ${numbered.totalLines} are shown. Do not comment on later lines.\n` : ""}
<file path="${file.path}">
${numbered.text}
</file>`,
        },
      ],
      reviewSchema,
      1800,
    );

    const { issues, droppedLines } = sanitizeIssues(result.issues, numbered.lastLine);
    const review: CodeReview = {
      path: file.path,
      summary: result.summary,
      issues,
      analyzedLines: numbered.lastLine,
      totalLines: numbered.totalLines,
      droppedLineRefs: droppedLines,
    };
    return NextResponse.json(review);
  } catch (err) {
    return errorResponse(err);
  }
}
