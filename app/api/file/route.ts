import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { assertInTree, getFileContent, getTree } from "@/lib/github";
import { fileRequestSchema } from "@/lib/validation";

/** POST /api/file  { owner, name, ref, path } -> file contents (only for paths in the tree) */
export async function POST(req: Request) {
  try {
    const { owner, name, ref, path } = fileRequestSchema.parse(await req.json().catch(() => ({})));
    const id = { owner, name };
    const tree = await getTree(id, ref);
    const entry = assertInTree(tree.files, path);
    return NextResponse.json(await getFileContent(id, ref, entry.path, entry.size));
  } catch (err) {
    return errorResponse(err);
  }
}
