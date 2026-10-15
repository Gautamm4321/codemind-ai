import { streamText, UNTRUSTED_CONTENT_RULE } from "@/lib/ai";
import { packFiles, pickOverviewFiles, treeOutline } from "@/lib/context-builder";
import { errorResponse } from "@/lib/errors";
import { LIMITS } from "@/lib/file-filter";
import { getFiles, getLanguages, getRepoMeta, getTree } from "@/lib/github";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { repoSnapshotSchema } from "@/lib/validation";

export const maxDuration = 30;

/** POST /api/readme  { owner, name, ref } -> streamed README.md draft for the repository */
export async function POST(req: Request) {
  try {
    enforceAiRateLimit(req);
    const { owner, name, ref } = repoSnapshotSchema.parse(await req.json().catch(() => ({})));
    const id = { owner, name };

    const [meta, languages, tree] = await Promise.all([getRepoMeta(id), getLanguages(id), getTree(id, ref)]);
    const files = await getFiles(id, ref, pickOverviewFiles(tree.files));
    const outline = treeOutline(tree.files, 150);
    const packed = packFiles(files, Math.max(2000, LIMITS.maxContextChars - outline.length));

    const stream = await streamText(
      [
        {
          role: "system",
          content: `You are CodeMind, a technical writer. Write a clear, professional README.md for this repository.
${UNTRUSTED_CONTENT_RULE}
Output ONLY the Markdown (no code fences around the whole document). Use this structure, skipping sections you have no evidence for:
# <project name>
<one-paragraph description>
## Features
## Tech stack
## Getting started
(prerequisites, install and run commands — ONLY commands evidenced by manifest files or the existing README)
## Available scripts
(only from package.json "scripts" or equivalent)
## Project structure
(a short tree of the main folders/files with one-line descriptions)
## License
(only if the license is known)
Where information is missing, write a short "TODO:" line for the author instead of inventing it.`,
        },
        {
          role: "user",
          content: `Repository: ${meta.fullName}
Description: ${meta.description ?? "(none)"}
License: ${meta.license ?? "(unknown)"}
Topics: ${meta.topics.join(", ") || "(none)"}
Languages: ${languages.slice(0, 8).map((l) => `${l.name} ${l.percent}%`).join(", ") || "(unknown)"}

FILE LIST:
${outline}

KEY FILE CONTENTS:
${packed.text || "(no readable key files)"}`,
        },
      ],
      2200,
    );

    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
