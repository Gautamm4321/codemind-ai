import { z } from "zod";

// GitHub rules: owner = 1-39 chars, alphanumeric or single hyphens, not starting with a hyphen.
// Repo = 1-100 chars of letters, digits, '.', '-', '_' (and not "." or "..").
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export const ownerSchema = z.string().regex(OWNER_RE, "Invalid GitHub owner name.");
export const repoNameSchema = z
  .string()
  .regex(REPO_RE, "Invalid repository name.")
  .refine((n) => n !== "." && n !== "..", "Invalid repository name.");

export const repoIdSchema = z.object({ owner: ownerSchema, name: repoNameSchema });
export type RepoId = z.infer<typeof repoIdSchema>;

/** A git commit SHA (we always read files at the exact SHA returned by /api/repo). */
export const refSchema = z.string().regex(/^[a-f0-9]{40}$/, "Invalid commit reference.");

/** A repo-relative file path. Must still be checked against the real tree before use. */
export const filePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((p) => !p.startsWith("/") && !p.split("/").some((s) => s === ".." || s === "." || s === ""), {
    message: "Invalid file path.",
  });

/**
 * Accepts the forms people actually paste:
 *   https://github.com/vercel/next.js
 *   github.com/vercel/next.js/tree/canary/packages
 *   https://github.com/vercel/next.js.git
 *   vercel/next.js
 * Returns { owner, name } or null. We never fetch the URL itself: only the extracted,
 * validated owner/name are used to build GitHub API URLs (SSRF protection).
 */
export function parseRepoUrl(input: string): RepoId | null {
  let s = input.trim();
  if (!s || s.length > 300) return null;

  // Shorthand "owner/repo"
  if (/^[^/\s:]+\/[^/\s:]+$/.test(s) && !s.includes(".com")) {
    const [owner, name] = s.split("/");
    return validate(owner, name.replace(/\.git$/, ""));
  }

  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;
  if (url.username || url.password || (url.port && url.port !== "443")) return null;

  const [owner, rawName] = url.pathname.split("/").filter(Boolean);
  if (!owner || !rawName) return null;
  return validate(owner, rawName.replace(/\.git$/, ""));
}

function validate(owner: string, name: string): RepoId | null {
  const result = repoIdSchema.safeParse({ owner, name });
  return result.success ? result.data : null;
}

// ---------- API request bodies ----------

export const repoRequestSchema = z.object({ url: z.string().min(1, "Please paste a GitHub URL.").max(300) });

export const repoSnapshotSchema = repoIdSchema.extend({ ref: refSchema });

export const fileRequestSchema = repoSnapshotSchema.extend({ path: filePathSchema });

export const chatRequestSchema = repoSnapshotSchema.extend({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20)
    .refine((m) => m[m.length - 1].role === "user", "The last message must be from the user."),
  activeFile: filePathSchema.optional(),
});
