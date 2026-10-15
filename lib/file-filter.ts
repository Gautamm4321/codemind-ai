// Decides which files in a repo are worth showing and sending to the model.
// Pure functions only, so they are easy to unit test.

export const LIMITS = {
  maxTreeFiles: 4000, // files kept in the tree after filtering
  maxViewBytes: 200_000, // largest file we will display
  maxExplainChars: 14_000, // file content sent for "Explain this file" (start + end kept)
  maxReviewChars: 12_000, // numbered file content sent for code review
  maxContextChars: Number(process.env.MAX_CONTEXT_CHARS) || 16_000, // total context per AI call
  maxFilesPerChat: 6,
} as const;

const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".next", ".nuxt", ".svelte-kit", "dist", "build", "out", "coverage",
  "vendor", "__pycache__", ".venv", "venv", "env", ".tox", "target", ".gradle", ".idea", ".vscode",
  ".cache", ".turbo", ".vercel", "bower_components", "Pods", "DerivedData", ".pytest_cache",
]);

const IGNORED_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock", "Cargo.lock",
  "poetry.lock", "Pipfile.lock", "composer.lock", "Gemfile.lock", "go.sum", "uv.lock",
  ".DS_Store", "Thumbs.db",
]);

const BINARY_EXTENSIONS = new Set([
  // images & media
  "png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "icns", "tif", "tiff", "psd",
  "mp3", "mp4", "wav", "ogg", "webm", "mov", "avi", "flac", "m4a",
  // fonts
  "woff", "woff2", "ttf", "otf", "eot",
  // archives & binaries
  "zip", "gz", "tgz", "tar", "rar", "7z", "bz2", "xz", "jar", "war", "exe", "dll", "so", "dylib",
  "bin", "o", "a", "class", "pyc", "wasm", "dmg", "iso", "apk", "ipa",
  // documents & data blobs
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "sqlite", "db", "parquet", "pkl", "h5",
  "onnx", "pt", "ckpt", "safetensors", "npy", "npz",
]);

function extension(path: string): string {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** True if the file should be hidden from the tree and never sent to the model. */
export function isIgnoredPath(path: string, size = 0): boolean {
  const parts = path.split("/");
  const file = parts[parts.length - 1];

  if (parts.slice(0, -1).some((dir) => IGNORED_DIRS.has(dir))) return true;
  if (IGNORED_FILES.has(file)) return true;
  if (BINARY_EXTENSIONS.has(extension(path))) return true;
  if (/\.min\.(js|css)$/i.test(file) || /\.map$/i.test(file)) return true;
  if (size > LIMITS.maxViewBytes) return true;
  return false;
}

/** Content-level check: GitHub sometimes serves binaries with text-looking names. */
export function looksBinary(content: string): boolean {
  return content.slice(0, 8000).includes("\u0000");
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift",
  c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", cs: "csharp", php: "php", scala: "scala",
  json: "json", yml: "yaml", yaml: "yaml", toml: "toml", xml: "xml", html: "markup", svg: "markup",
  css: "css", scss: "scss", less: "less", md: "markdown", mdx: "markdown", sh: "bash", bash: "bash",
  zsh: "bash", sql: "sql", graphql: "graphql", gql: "graphql", dart: "dart", lua: "lua", r: "r",
  vue: "markup", svelte: "markup", dockerfile: "docker", ex: "elixir", exs: "elixir", hs: "haskell",
};

export function detectLanguage(path: string): string {
  const file = (path.split("/").pop() ?? "").toLowerCase();
  if (file === "dockerfile") return "docker";
  if (file === "makefile") return "makefile";
  return LANGUAGE_BY_EXT[extension(path)] ?? "text";
}
