import { streamText, UNTRUSTED_CONTENT_RULE } from "@/lib/ai";
import { errorResponse } from "@/lib/errors";
import { LIMITS } from "@/lib/file-filter";
import { assertInTree, getFileContent, getTree } from "@/lib/github";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { truncateMiddle } from "@/lib/truncate";
import { fileRequestSchema } from "@/lib/validation";

export const maxDuration = 30;

/**
 * POST /api/explain  { owner, name, ref, path } -> streamed markdown explanation.
 * Response headers tell the UI whether the file had to be shortened (X-Truncated, X-Shown-Chars, X-Total-Chars).
 */
export async function POST(req: Request) {
  try {
    enforceAiRateLimit(req);
    const { owner, name, ref, path } = fileRequestSchema.parse(await req.json().catch(() => ({})));
    const id = { owner, name };
    const tree = await getTree(id, ref);
    const entry = assertInTree(tree.files, path);
    const file = await getFileContent(id, ref, entry.path, entry.size);

    const t = truncateMiddle(file.content, LIMITS.maxExplainChars);

    const stream = await streamText([
      {
        role: "system",
        content: `You are CodeMind, a senior engineer explaining a file to a developer new to this codebase.
${UNTRUSTED_CONTENT_RULE}
Write concise Markdown with these sections:
## What it does
## How it works
(walk through the main functions/components/sections in order)
## Key details
(important logic, dependencies, gotchas)
## How it connects
(what it imports/links to and what likely uses it, based only on references you can see)
${t.truncated ? "## Not analyzed\n(one or two sentences on what the omitted middle part might matter for, WITHOUT guessing its contents)\n" : ""}Stay grounded in the code shown. Do not invent functions, files or assets that are not in the file.`,
      },
      {
        role: "user",
        content: `Repository: ${owner}/${name}
${
  t.truncated
    ? `NOTE: This file has ${t.totalChars.toLocaleString("en")} characters. You are seeing the beginning and the end (${t.shownChars.toLocaleString("en")} characters); the middle is omitted.\n`
    : ""
}
<file path="${file.path}">
${t.text}
</file>`,
      },
    ]);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Truncated": t.truncated ? "1" : "0",
        "X-Shown-Chars": String(t.shownChars),
        "X-Total-Chars": String(t.totalChars),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
