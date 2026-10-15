import { NextResponse } from "next/server";
import { z } from "zod";
import { completeJSON, UNTRUSTED_CONTENT_RULE } from "@/lib/ai";
import { decideStatus, INSUFFICIENT_EVIDENCE_MESSAGE, verifyCitations } from "@/lib/citations";
import { packFiles, rankByContent, rankFilesByPath, resolveRelativeImports, treeOutline } from "@/lib/context-builder";
import { errorResponse } from "@/lib/errors";
import { LIMITS } from "@/lib/file-filter";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { getFiles, getTree } from "@/lib/github";
import { chatRequestSchema } from "@/lib/validation";
import type { ChatResponse } from "@/types";

export const maxDuration = 30;

const answerSchema = z.object({
  answer: z.string().max(6000),
  citations: z.array(z.object({ path: z.string(), reason: z.string().optional() })).max(10),
  enoughEvidence: z.boolean(),
});

/** POST /api/chat  { owner, name, ref, messages, activeFile? } -> answer with verified citations */
export async function POST(req: Request) {
  try {
    enforceAiRateLimit(req);
    const { owner, name, ref, messages, activeFile } = chatRequestSchema.parse(await req.json().catch(() => ({})));
    const id = { owner, name };
    const tree = await getTree(id, ref);
    const treePaths = new Set(tree.files.map((f) => f.path));
    const question = messages[messages.length - 1].content;

    // Use recent user turns too, so follow-ups like "and how is it tested?" keep context.
    const searchText = messages
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => m.content)
      .join(" ");

    // 1) Rank by path, 2) fetch top candidates, 3) follow relative imports, 4) re-rank by content.
    const ranked = rankFilesByPath(tree.files, searchText, {
      activeFile: activeFile && treePaths.has(activeFile) ? activeFile : undefined,
      limit: 8,
    });
    const fetched = await getFiles(id, ref, ranked.slice(0, 5));

    const importPaths = new Set<string>();
    for (const f of fetched.slice(0, 3)) for (const p of resolveRelativeImports(f, treePaths)) importPaths.add(p);
    const already = new Set(fetched.map((f) => f.path));
    const extraEntries = tree.files.filter((f) => importPaths.has(f.path) && !already.has(f.path)).slice(0, 2);
    const extra = await getFiles(id, ref, extraEntries);

    const pathScores = new Map(ranked.map((r) => [r.path, r.score]));
    const ordered = rankByContent([...fetched, ...extra], searchText, pathScores).slice(0, LIMITS.maxFilesPerChat);

    const outline = treeOutline(tree.files, 120);
    const packed = packFiles(ordered, Math.max(2000, LIMITS.maxContextChars - outline.length));

    const system = `You are CodeMind, an assistant that answers questions about ONE GitHub repository (${owner}/${name}).
${UNTRUSTED_CONTENT_RULE}
Answer ONLY from the FILES provided below. Respond with ONLY a JSON object:
{
  "answer": "Markdown answer. Refer to files by their exact path in backticks.",
  "citations": [{"path": "exact path of a file you used", "reason": "what it shows"}],
  "enoughEvidence": true
}
Rules:
- Every factual claim must be supported by a cited file from FILES. Cite exact paths only.
- If the files do not contain the answer, set "enoughEvidence": false, give an empty "citations" list, and briefly say what is missing in "answer".
- Never invent files, functions, or behaviour. Keep answers focused and concise.`;

    const history = messages.slice(-7, -1).map((m) => ({
      role: m.role,
      content: m.content.slice(0, 1500),
    }));

    const result = await completeJSON(
      [
        { role: "system", content: system },
        ...history,
        {
          role: "user",
          content: `FILE LIST (partial):\n${outline}\n\nFILES:\n${packed.text || "(no matching files)"}\n\nQUESTION: ${question}`,
        },
      ],
      answerSchema,
    );

    const { valid, dropped } = verifyCitations(result.citations, treePaths);
    const status = decideStatus(result.enoughEvidence && packed.included.length > 0, valid.length);

    const response: ChatResponse = {
      answer:
        status === "insufficient_evidence"
          ? `${INSUFFICIENT_EVIDENCE_MESSAGE}${result.answer ? `\n\n${result.answer}` : ""}`
          : result.answer,
      citations: status === "insufficient_evidence" ? [] : valid,
      droppedCitations: dropped,
      status,
      filesRead: packed.included,
    };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
