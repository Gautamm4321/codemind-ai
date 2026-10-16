import "server-only";
import { AppError } from "./errors";
import { LIMITS, detectLanguage, isIgnoredPath, looksBinary } from "./file-filter";
import type { RepoId } from "./validation";
import type { FileContent, LanguageShare, RepoData, RepoMeta, TreeFile } from "@/types";

const API = "https://api.github.com";

/**
 * Set when GitHub rejects GITHUB_TOKEN (expired, revoked or mistyped). The app then keeps
 * working without a token (public repos, 60 requests/hour) instead of failing every request.
 */
let tokenRejected = false;

function headers(accept = "application/vnd.github+json"): HeadersInit {
  const h: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "codemind-ai",
  };
  // Server-side only. Never expose this to the browser.
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token && !tokenRejected) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Path segments are encoded one by one so a path can never change the URL's host or route. */
const seg = (s: string) => encodeURIComponent(s);
const repoBase = ({ owner, name }: RepoId) => `${API}/repos/${seg(owner)}/${seg(name)}`;

interface GhOptions {
  accept?: string;
  /** Immutable data (anything addressed by commit SHA) can be cached forever. */
  immutable?: boolean;
}

async function gh(url: string, opts: GhOptions = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: headers(opts.accept),
      ...(opts.immutable ? { cache: "force-cache" as const } : { next: { revalidate: 300 } }),
    });
  } catch {
    throw new AppError("GITHUB_ERROR", "Could not reach GitHub. Check your connection and try again.", 502);
  }

  if (res.ok) return res;

  // Bad token: fall back to unauthenticated requests rather than breaking the site.
  if (res.status === 401 && process.env.GITHUB_TOKEN && !tokenRejected) {
    tokenRejected = true;
    console.warn("[codemind] GitHub rejected GITHUB_TOKEN (expired, revoked or mistyped). Continuing without it; replace the token to restore the higher rate limit.");
    return gh(url, opts);
  }

  const remaining = res.headers.get("x-ratelimit-remaining");
  if (res.status === 429 || (res.status === 403 && remaining === "0")) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const mins = reset ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000)) : null;
    throw new AppError(
      "GITHUB_RATE_LIMIT",
      `GitHub rate limit reached.${mins ? ` Try again in about ${mins} min.` : ""}${
        process.env.GITHUB_TOKEN && !tokenRejected ? "" : " Adding a valid GITHUB_TOKEN raises the limit."
      }`,
      429,
    );
  }
  if (res.status === 404) throw new AppError("REPO_NOT_FOUND", "Repository not found, or it is private.", 404);
  if (res.status === 401)
    throw new AppError("GITHUB_ERROR", "GitHub rejected the server token. Check GITHUB_TOKEN.", 502);
  if (res.status === 409) throw new AppError("REPO_NOT_FOUND", "This repository is empty.", 404);
  throw new AppError("GITHUB_ERROR", `GitHub returned an error (${res.status}).`, 502);
}

// ---------- Repo metadata, languages and tree ----------

interface GhRepo {
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: { spdx_id: string | null; name: string } | null;
  topics?: string[];
  updated_at: string;
  private: boolean;
}

interface GhTree {
  sha: string;
  truncated: boolean;
  tree: { path: string; type: "blob" | "tree" | "commit"; size?: number }[];
}

export async function getRepoMeta(id: RepoId): Promise<RepoMeta> {
  const r = (await (await gh(repoBase(id))).json()) as GhRepo;
  if (r.private) throw new AppError("REPO_NOT_FOUND", "Only public repositories are supported.", 404);
  return {
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
    license: r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : null,
    topics: r.topics ?? [],
    updatedAt: r.updated_at,
  };
}

export async function getLanguages(id: RepoId): Promise<LanguageShare[]> {
  const raw = (await (await gh(`${repoBase(id)}/languages`)).json()) as Record<string, number>;
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(raw)
    .map(([name, bytes]) => ({ name, bytes, percent: Math.round((bytes / total) * 1000) / 10 }))
    .sort((a, b) => b.bytes - a.bytes);
}

async function getHeadSha(id: RepoId, branch: string): Promise<string> {
  const res = await gh(`${repoBase(id)}/commits/${seg(branch)}`, { accept: "application/vnd.github.sha" });
  const sha = (await res.text()).trim();
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new AppError("GITHUB_ERROR", "Could not resolve the latest commit.", 502);
  return sha;
}

export interface Tree {
  files: TreeFile[];
  truncated: boolean;
  skippedCount: number;
}

/** Recursive file tree at a specific commit, with junk filtered out. */
export async function getTree(id: RepoId, sha: string): Promise<Tree> {
  const data = (await (await gh(`${repoBase(id)}/git/trees/${seg(sha)}?recursive=1`, { immutable: true })).json()) as GhTree;

  const blobs = data.tree.filter((e) => e.type === "blob");
  const kept = blobs.filter((e) => !isIgnoredPath(e.path, e.size ?? 0));
  const files = kept.slice(0, LIMITS.maxTreeFiles).map((e) => ({ path: e.path, size: e.size ?? 0 }));

  return {
    files,
    truncated: data.truncated || kept.length > LIMITS.maxTreeFiles,
    skippedCount: blobs.length - kept.length,
  };
}

export async function getRepoData(id: RepoId): Promise<RepoData> {
  const [meta, languages] = await Promise.all([getRepoMeta(id), getLanguages(id)]);
  const ref = await getHeadSha(id, meta.defaultBranch);
  const tree = await getTree(id, ref);
  return { meta, languages, ref, ...tree };
}

// ---------- File contents ----------

/**
 * Reads one file. `path` must come from the tree (call assertInTree first),
 * so we only ever fetch files that really exist in this repo.
 */
export async function getFileContent(id: RepoId, ref: string, path: string, size: number): Promise<FileContent> {
  if (size > LIMITS.maxViewBytes) throw new AppError("FILE_TOO_LARGE", "This file is too large to display.", 413);

  const url = `${repoBase(id)}/contents/${path.split("/").map(seg).join("/")}?ref=${seg(ref)}`;
  const res = await gh(url, { accept: "application/vnd.github.raw+json", immutable: true });
  const content = await res.text();

  if (looksBinary(content)) throw new AppError("BINARY_FILE", "This looks like a binary file.", 415);
  return { path, content, size, language: detectLanguage(path) };
}

/** Throws unless `path` exists in the (filtered) tree. Returns the tree entry. */
export function assertInTree(files: TreeFile[], path: string): TreeFile {
  const hit = files.find((f) => f.path === path);
  if (!hit) throw new AppError("FILE_NOT_FOUND", "That file is not in this repository.", 404);
  return hit;
}

/** Fetches several files in parallel, silently skipping any that fail. */
export async function getFiles(id: RepoId, ref: string, entries: TreeFile[]): Promise<FileContent[]> {
  const results = await Promise.allSettled(entries.map((e) => getFileContent(id, ref, e.path, e.size)));
  const out: FileContent[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") out.push(r.value);
    else if (r.reason instanceof AppError && r.reason.code === "GITHUB_RATE_LIMIT") throw r.reason;
  }
  return out;
}
