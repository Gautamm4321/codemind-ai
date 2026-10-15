// Shared types used by both the API routes and the UI.

export interface RepoMeta {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  topics: string[];
  updatedAt: string;
}

export interface LanguageShare {
  name: string;
  bytes: number;
  percent: number;
}

export interface TreeFile {
  path: string;
  size: number;
}

export interface RepoData {
  meta: RepoMeta;
  languages: LanguageShare[];
  files: TreeFile[]; // filtered, text-like files only
  ref: string; // commit SHA the tree was read at, so every later request reads the same snapshot
  truncated: boolean; // true if GitHub or our limits cut the tree short
  skippedCount: number; // files hidden by the filter (node_modules, images, lockfiles, ...)
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  language: string;
}

export interface RepoOverview {
  purpose: string;
  summary: string;
  techStack: string[];
  keyFiles: { path: string; reason: string }[];
  architecture: string;
}

export interface Citation {
  path: string;
  reason?: string;
}

export type ChatStatus = "answered" | "insufficient_evidence" | "unverified";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  droppedCitations: string[];
  status: ChatStatus;
  filesRead: string[];
}

export interface CodeReviewIssue {
  severity: "high" | "medium" | "low";
  category: string;
  title: string;
  detail: string;
  line: number | null;
}

export interface CodeReview {
  path: string;
  summary: string;
  issues: CodeReviewIssue[];
  analyzedLines: number;
  totalLines: number;
  droppedLineRefs: number;
}

/** Shown under AI output when only part of a file was sent to the model. */
export interface TruncationNote {
  shownChars: number;
  totalChars: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
