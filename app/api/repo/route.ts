import { NextResponse } from "next/server";
import { errorResponse, AppError } from "@/lib/errors";
import { getRepoData } from "@/lib/github";
import { parseRepoUrl, repoIdSchema, repoRequestSchema } from "@/lib/validation";

/**
 * POST /api/repo  { url } or { owner, name }
 * Returns metadata, language breakdown and the filtered file tree.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const direct = repoIdSchema.safeParse(body);
    const id = direct.success ? direct.data : parseRepoUrl(repoRequestSchema.parse(body).url);
    if (!id) {
      throw new AppError("INVALID_INPUT", "That doesn't look like a GitHub repo URL. Try https://github.com/owner/repo.");
    }

    return NextResponse.json(await getRepoData(id));
  } catch (err) {
    return errorResponse(err);
  }
}
