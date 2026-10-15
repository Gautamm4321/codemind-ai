import { NextResponse } from "next/server";
import { z } from "zod";
import { completeJSON, UNTRUSTED_CONTENT_RULE } from "@/lib/ai";
import { verifyCitations } from "@/lib/citations";
import { packFiles, pickOverviewFiles, treeOutline } from "@/lib/context-builder";
import { errorResponse } from "@/lib/errors";
import { LIMITS } from "@/lib/file-filter";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { getFiles, getLanguages, getRepoMeta, getTree } from "@/lib/github";
import { repoSnapshotSchema } from "@/lib/validation";
import type { RepoOverview } from "@/types";

export const maxDuration = 30;

const overviewSchema = z.object({
  purpose: z.string().min(1).max(400),
  summary: z.string().min(1).max(2000),
  techStack: z.array(z.string().max(60)).max(15),
  keyFiles: z.array(z.object({ path: z.string(), reason: z.string().max(200) })).max(8),
  architecture: z.string().max(1500),
});

/** POST /api/overview  { owner, name, ref } -> AI project overview (Zod-validated JSON) */
export async function POST(req: Request) {
  try {
    enforceAiRateLimit(req);
    const { owner, name, ref } = repoSnapshotSchema.parse(await req.json().catch(() => ({})));
    const id = { owner, name };

    const [meta, languages, tree] = await Promise.all([getRepoMeta(id), getLanguages(id), getTree(id, ref)]);
    const files = await getFiles(id, ref, pickOverviewFiles(tree.files));

    const outline = treeOutline(tree.files, 200);
    const budget = Math.max(2000, LIMITS.maxContextChars - outline.length);
    const packed = packFiles(files, budget);

    const system = `You are CodeMind, an expert software engineer who explains codebases to developers.
${UNTRUSTED_CONTENT_RULE}
Respond with ONLY a JSON object of this exact shape:
{
  "purpose": "one sentence: what this project is for",
  "summary": "2-4 sentence plain-English summary",
  "techStack": ["main languages, frameworks, libraries"],
  "keyFiles": [{"path": "exact path from the file list", "reason": "why to read it first"}],
  "architecture": "short paragraph on how the code is organised"
}
Rules: keyFiles must use exact paths from the FILE LIST (3-6 entries, in reading order). Base everything on the provided data; if unsure, say so.`;

    const user = `Repository: ${meta.fullName}
Description: ${meta.description ?? "(none)"}
Topics: ${meta.topics.join(", ") || "(none)"}
Languages: ${languages.slice(0, 8).map((l) => `${l.name} ${l.percent}%`).join(", ") || "(unknown)"}

FILE LIST:
${outline}

KEY FILE CONTENTS:
${packed.text || "(no readable key files)"}`;

    const result = await completeJSON(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      overviewSchema,
    );

    // Same verification as chat: only keep key files that really exist.
    const treePaths = new Set(tree.files.map((f) => f.path));
    const { valid } = verifyCitations(result.keyFiles, treePaths);
    const overview: RepoOverview = {
      ...result,
      keyFiles: valid.map((c) => ({ path: c.path, reason: c.reason ?? "" })),
    };
    return NextResponse.json(overview);
  } catch (err) {
    return errorResponse(err);
  }
}
