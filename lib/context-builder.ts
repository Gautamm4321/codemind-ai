// Context budgeting: choose a handful of relevant files and pack them into a fixed
// character budget, instead of sending the whole repo to the model.
// Everything here is pure (no network) so it can be unit tested.

import { truncateMiddle } from "./truncate";
import type { FileContent, TreeFile } from "@/types";

const STOPWORDS = new Set(
  ("a an and are as at be but by can do does for from how i in is it its of on or that the this to " +
    "what when where which who why will with you your me my we our about into there their they them " +
    "file files code repo repository project explain show tell work works used use using does doing")
    .split(" "),
);

const ENTRY_POINT_RE =
  /(^|\/)(readme\.md|package\.json|pyproject\.toml|requirements\.txt|go\.mod|cargo\.toml|pom\.xml|build\.gradle|composer\.json|gemfile|main\.\w+|index\.\w+|app\.\w+|server\.\w+|manage\.py|setup\.py)$/i;

export function keywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, " ")
    .split(/\s+/)
    .flatMap((w) => [w, ...w.split(/[./_-]/)])
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 25);
}

/** Splits camelCase / snake_case / kebab-case names into lowercase words. */
function nameTokens(path: string): string[] {
  return path
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export interface ScoredFile extends TreeFile {
  score: number;
}

/** Ranks tree files by how well their path matches the question. */
export function rankFilesByPath(
  files: TreeFile[],
  question: string,
  opts: { activeFile?: string; limit?: number } = {},
): ScoredFile[] {
  const kws = keywords(question);
  const q = question.toLowerCase();

  const scored = files.map((f) => {
    const lower = f.path.toLowerCase();
    const base = lower.split("/").pop() ?? "";
    const tokens = nameTokens(f.path);
    const baseTokens = nameTokens(base);
    let score = 0;

    if (q.includes(lower)) score += 30; // full path mentioned
    else if (base.length > 3 && q.includes(base)) score += 15; // filename mentioned

    for (const kw of kws) {
      if (baseTokens.includes(kw)) score += 6;
      else if (base.includes(kw)) score += 4;
      else if (tokens.includes(kw)) score += 2;
    }
    if (ENTRY_POINT_RE.test(lower)) score += 1;
    if (f.path === opts.activeFile) score += 8;
    if (/(^|\/)(test|tests|__tests__|spec|examples?|docs?|fixtures?)\//.test(lower) && !kws.some((k) => /test|spec|example|doc/.test(k)))
      score -= 2;
    // Slight preference for shallow, small files
    score -= f.path.split("/").length * 0.1;
    score -= f.size / 200_000;

    return { ...f, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 12);
}

/** Re-ranks fetched files by how often question keywords appear in their contents. */
export function rankByContent(files: FileContent[], question: string, pathScores: Map<string, number>): FileContent[] {
  const kws = keywords(question);
  const score = (f: FileContent) => {
    const text = f.content.toLowerCase();
    let hits = 0;
    for (const kw of kws) hits += Math.min(5, text.split(kw).length - 1);
    return (pathScores.get(f.path) ?? 0) + hits;
  };
  return [...files].sort((a, b) => score(b) - score(a));
}

/** Resolves relative imports (./x, ../y) in a file to real paths in the tree. */
export function resolveRelativeImports(file: FileContent, treePaths: Set<string>): string[] {
  const specs = new Set<string>();
  const patterns = [
    /\bimport\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/g,
    /\bimport\s+['"](\.{1,2}\/[^'"]+)['"]/g,
    /\brequire\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
    /\bfrom\s+(\.+[\w.]*)\s+import\b/g, // python relative imports
  ];
  for (const re of patterns) for (const m of file.content.matchAll(re)) specs.add(m[1]);

  const dir = file.path.split("/").slice(0, -1);
  const out: string[] = [];
  for (const spec of specs) {
    const target = spec.startsWith(".") && !spec.includes("/") ? pythonToPath(spec) : spec;
    const joined = normalize([...dir, ...target.split("/")]);
    if (!joined) continue;
    const candidates = [
      joined,
      ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".vue", ".svelte"].map((e) => joined + e),
      ...["/index.ts", "/index.tsx", "/index.js", "/__init__.py"].map((e) => joined + e),
    ];
    const hit = candidates.find((c) => treePaths.has(c));
    if (hit) out.push(hit);
  }
  return out;
}

function pythonToPath(spec: string): string {
  const dots = spec.match(/^\.+/)?.[0].length ?? 1;
  const rest = spec.slice(dots).replace(/\./g, "/");
  return ["."].concat(Array(dots - 1).fill("..")).concat(rest ? [rest] : []).join("/");
}

function normalize(parts: string[]): string | null {
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") {
      if (!out.length) return null;
      out.pop();
    } else out.push(p);
  }
  return out.join("/") || null;
}

/**
 * Packs files into the character budget, wrapped in <file> tags.
 * Files that don't fit are shortened (start + end kept) rather than dropped entirely.
 */
export function packFiles(files: FileContent[], budget: number): { text: string; included: string[] } {
  let remaining = budget;
  const parts: string[] = [];
  const included: string[] = [];

  for (const f of files) {
    const overhead = f.path.length + 40;
    if (remaining < overhead + 300) break;
    const room = remaining - overhead;
    // Large files keep their start and end, with an explicit OMITTED marker in between.
    const body = f.content.length > room ? truncateMiddle(f.content, Math.max(200, room - 120)).text : f.content;
    parts.push(`<file path="${f.path}">\n${body}\n</file>`);
    included.push(f.path);
    remaining -= body.length + overhead;
  }
  return { text: parts.join("\n\n"), included };
}

/** Compact directory listing so the model knows the repo's shape without reading every file. */
export function treeOutline(files: TreeFile[], maxLines = 250): string {
  const lines = files.slice(0, maxLines).map((f) => f.path);
  if (files.length > maxLines) lines.push(`... and ${files.length - maxLines} more files`);
  return lines.join("\n");
}

/** Files most useful for a first overview: README + manifests + likely entry points. */
export function pickOverviewFiles(files: TreeFile[]): TreeFile[] {
  const byPriority = (p: string): number => {
    const l = p.toLowerCase();
    const depth = p.split("/").length;
    if (/^readme(\.md|\.rst|\.txt)?$/.test(l)) return 100;
    if (depth === 1 && /^(package\.json|pyproject\.toml|requirements\.txt|go\.mod|cargo\.toml|pom\.xml|build\.gradle(\.kts)?|composer\.json|gemfile)$/.test(l)) return 90;
    if (depth === 1 && /^(dockerfile|docker-compose\.ya?ml|next\.config\.\w+|vite\.config\.\w+|tsconfig\.json)$/.test(l)) return 60;
    if (depth <= 3 && /(^|\/)(main|index|app|server|cli|__main__|manage)\.\w+$/.test(l)) return 50 - depth;
    return 0;
  };
  return files
    .map((f) => ({ f, p: byPriority(f.path) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p)
    .slice(0, 6)
    .map((x) => x.f);
}
