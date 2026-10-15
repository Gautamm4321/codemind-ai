"use client";

import { ClipboardCheck, FileCode, Info, LoaderCircle, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { ErrorNotice, Loading } from "./Notice";
import { navyCodeTheme } from "./navy-code-theme";
import { postJSON, postStream } from "@/lib/client";
import { ink } from "@/lib/theme";
import type { CodeReview, CodeReviewIssue, FileContent, TruncationNote } from "@/types";

const HIGHLIGHT_LIMIT = 60_000; // chars; bigger files render as plain numbered text to stay fast

export interface RepoRef {
  owner: string;
  name: string;
  ref: string;
}

export interface ExplainResult {
  text: string;
  note: TruncationNote | null;
}

interface Props {
  repo: RepoRef;
  path: string | null;
  fileCache: Map<string, FileContent>;
  explainCache: Map<string, ExplainResult>;
  reviewCache: Map<string, CodeReview>;
}

type Panel = "explain" | "review" | null;

export default function CodeViewer({ repo, path, fileCache, explainCache, reviewCache }: Props) {
  const [file, setFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [panel, setPanel] = useState<Panel>(null);
  const [explanation, setExplanation] = useState<ExplainResult | null>(null);
  const [review, setReview] = useState<CodeReview | null>(null);
  const [aiBusy, setAiBusy] = useState<Panel>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load file contents whenever the selected path changes.
  useEffect(() => {
    abortRef.current?.abort();
    setAiBusy(null);
    setAiError(null);
    setFocusLine(null);
    const cachedExplain = path ? (explainCache.get(path) ?? null) : null;
    const cachedReview = path ? (reviewCache.get(path) ?? null) : null;
    setExplanation(cachedExplain);
    setReview(cachedReview);
    setPanel(cachedExplain ? "explain" : cachedReview ? "review" : null);
    scrollRef.current?.scrollTo({ top: 0 });

    if (!path) {
      setFile(null);
      return;
    }
    const cached = fileCache.get(path);
    if (cached) {
      setFile(cached);
      setError(null);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setFile(null);
    postJSON<FileContent>("/api/file", { ...repo, path }, ctrl.signal)
      .then((f) => {
        fileCache.set(path, f);
        setFile(f);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [path, repo, fileCache, explainCache, reviewCache, reload]);

  // Scroll a line into view when a review issue is clicked.
  useEffect(() => {
    if (focusLine) document.getElementById(`L${focusLine}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusLine]);

  const startAi = useCallback((kind: Exclude<Panel, null>) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPanel(kind);
    setAiBusy(kind);
    setAiError(null);
    return ctrl;
  }, []);

  const explain = useCallback(async () => {
    if (!path) return;
    const ctrl = startAi("explain");
    let note: TruncationNote | null = null;
    setExplanation({ text: "", note: null });
    try {
      const text = await postStream(
        "/api/explain",
        { ...repo, path },
        (t) => setExplanation({ text: t, note }),
        ctrl.signal,
        (res) => {
          if (res.headers.get("X-Truncated") === "1") {
            note = { shownChars: Number(res.headers.get("X-Shown-Chars")), totalChars: Number(res.headers.get("X-Total-Chars")) };
          }
        },
      );
      const result = { text, note };
      explainCache.set(path, result);
      setExplanation(result);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setAiError((e as Error).message);
        setExplanation(null);
      }
    } finally {
      if (abortRef.current === ctrl) setAiBusy(null);
    }
  }, [path, repo, explainCache, startAi]);

  const runReview = useCallback(async () => {
    if (!path) return;
    const ctrl = startAi("review");
    setReview(null);
    try {
      const result = await postJSON<CodeReview>("/api/review", { ...repo, path }, ctrl.signal);
      reviewCache.set(path, result);
      setReview(result);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setAiError((e as Error).message);
    } finally {
      if (abortRef.current === ctrl) setAiBusy(null);
    }
  }, [path, repo, reviewCache, startAi]);

  if (!path) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <FileCode className="size-8" />
        <p className="heading-serif text-2xl">Pick a file</p>
        <p className="max-w-sm text-sm">Choose a file from the tree to read it, then ask the AI to explain or review it.</p>
      </div>
    );
  }

  const lineCount = file ? file.content.split("\n").length : 0;
  const plain = !!file && (file.content.length > HIGHLIGHT_LIMIT || file.language === "text");
  const reviewedLines = new Set(review?.issues.map((i) => i.line).filter((l): l is number => l !== null));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-navy px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-medium" title={path}>
            {path}
          </p>
          {file && (
            <p className="text-xs opacity-70">
              {lineCount.toLocaleString()} lines · {(file.size / 1024).toFixed(1)} KB · {file.language}
            </p>
          )}
        </div>
        <button
          onClick={() => (explanation && panel !== "explain" && !aiBusy ? setPanel("explain") : explain())}
          disabled={!file || aiBusy !== null}
          className={`btn px-4 py-1.5 text-xs ${panel === "explain" ? "btn-solid" : ""}`}
        >
          {aiBusy === "explain" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {explanation && panel === "explain" && !aiBusy ? "Re-explain" : "Explain"}
        </button>
        <button
          onClick={() => (review && panel !== "review" && !aiBusy ? setPanel("review") : runReview())}
          disabled={!file || aiBusy !== null}
          className={`btn px-4 py-1.5 text-xs ${panel === "review" ? "btn-solid" : ""}`}
        >
          {aiBusy === "review" ? <LoaderCircle className="size-3.5 animate-spin" /> : <ClipboardCheck className="size-3.5" />}
          {review && panel === "review" && !aiBusy ? "Re-review" : "Review code"}
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        {panel && (
          <AiPanel
            title={panel === "explain" ? "Explanation" : "Code review"}
            onClose={() => {
              abortRef.current?.abort();
              setAiBusy(null);
              setPanel(null);
              setAiError(null);
              setFocusLine(null);
            }}
          >
            {aiError ? (
              <p className="text-sm">{aiError}</p>
            ) : panel === "explain" ? (
              !explanation || explanation.text === "" ? (
                <Loading label="Reading the file…" />
              ) : (
                <>
                  {explanation.note && <TruncationBanner note={explanation.note} />}
                  <div className="prose-navy">
                    <ReactMarkdown>{explanation.text}</ReactMarkdown>
                  </div>
                </>
              )
            ) : !review ? (
              <Loading label="Reviewing the code…" />
            ) : (
              <ReviewResult review={review} activeLine={focusLine} onLine={setFocusLine} />
            )}
          </AiPanel>
        )}

        {loading && <Loading label="Loading file…" />}
        {error && (
          <ErrorNotice
            message={error}
            onRetry={() => {
              fileCache.delete(path);
              setReload((n) => n + 1);
            }}
          />
        )}

        {file && plain && (
          <>
            {file.content.length > HIGHLIGHT_LIMIT && (
              <p className="flex items-center gap-1.5 px-4 pt-3 text-xs opacity-70">
                <Info className="size-3.5" /> Large file: syntax colors are off to keep scrolling fast.
              </p>
            )}
            <PlainCode content={file.content} focusLine={focusLine} markedLines={reviewedLines} />
          </>
        )}
        {file && !plain && (
          <SyntaxHighlighter
            language={file.language}
            style={navyCodeTheme}
            showLineNumbers
            wrapLines
            lineProps={(n: number) => ({
              id: `L${n}`,
              style: {
                display: "block",
                backgroundColor: n === focusLine ? ink(0.12) : reviewedLines.has(n) ? ink(0.05) : undefined,
              },
            })}
            lineNumberStyle={{ color: ink(0.4), minWidth: "2.75em", paddingRight: "1em", fontStyle: "normal", fontWeight: 400 }}
            customStyle={{ background: "transparent", margin: 0 }}
          >
            {file.content}
          </SyntaxHighlighter>
        )}
        {file && !file.content.trim() && <p className="p-4 text-sm">This file is empty.</p>}
      </div>
    </div>
  );
}

function AiPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <section className="m-4 rounded-2xl border border-navy p-4" aria-live="polite">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="heading-serif text-xl">{title}</h3>
        <button onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="rounded-full p-1 hover:bg-navy hover:text-beige">
          <X className="size-4" />
        </button>
      </div>
      {children}
    </section>
  );
}

export function TruncationBanner({ note }: { note: TruncationNote }) {
  const pct = Math.round((note.shownChars / note.totalChars) * 100);
  return (
    <p className="my-2 flex items-start gap-2 rounded-xl border border-dashed border-navy px-3 py-2 text-xs">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Large file: only {pct}% was analyzed (the beginning and the end, {note.shownChars.toLocaleString()} of{" "}
        {note.totalChars.toLocaleString()} characters). Anything in the middle is not covered by this explanation.
      </span>
    </p>
  );
}

function ReviewResult({ review, activeLine, onLine }: { review: CodeReview; activeLine: number | null; onLine: (n: number) => void }) {
  const partial = review.analyzedLines < review.totalLines;
  return (
    <div className="space-y-3 text-sm">
      {partial && (
        <p className="flex items-start gap-2 rounded-xl border border-dashed border-navy px-3 py-2 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Large file: lines 1–{review.analyzedLines.toLocaleString()} of {review.totalLines.toLocaleString()} were reviewed.
        </p>
      )}
      <p className="leading-relaxed">{review.summary}</p>
      {review.issues.length === 0 ? (
        <p className="opacity-80">No significant issues found in the reviewed code.</p>
      ) : (
        <ul className="divide-y divide-navy/25 border-y border-navy/25">
          {review.issues.map((issue, i) => (
            <IssueRow key={i} issue={issue} active={issue.line !== null && issue.line === activeLine} onLine={onLine} />
          ))}
        </ul>
      )}
      {review.droppedLineRefs > 0 && (
        <p className="text-xs opacity-70">
          {review.droppedLineRefs} line reference{review.droppedLineRefs > 1 ? "s" : ""} pointed outside the reviewed code and{" "}
          {review.droppedLineRefs > 1 ? "were" : "was"} removed.
        </p>
      )}
    </div>
  );
}

function IssueRow({ issue, active, onLine }: { issue: CodeReviewIssue; active: boolean; onLine: (n: number) => void }) {
  return (
    <li className={`py-3 ${active ? "bg-navy/5" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`label rounded-full border border-navy px-2 py-0.5 ${
            issue.severity === "high" ? "bg-navy text-beige" : issue.severity === "medium" ? "bg-navy/15" : ""
          }`}
        >
          {issue.severity}
        </span>
        <span className="text-xs opacity-70">{issue.category}</span>
        {issue.line !== null && (
          <button onClick={() => onLine(issue.line!)} className="ml-auto font-mono text-xs underline underline-offset-2">
            Line {issue.line}
          </button>
        )}
      </div>
      <p className="mt-1.5 font-medium">{issue.title}</p>
      <div className="prose-navy mt-1 text-sm">
        <ReactMarkdown>{issue.detail}</ReactMarkdown>
      </div>
    </li>
  );
}

/** Numbered plain-text code (for very large or unknown-language files). */
function PlainCode({ content, focusLine, markedLines }: { content: string; focusLine: number | null; markedLines: Set<number> }) {
  const lines = content.split("\n");
  const width = `${String(lines.length).length + 1}ch`;
  return (
    <pre className="p-4 font-mono text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        const n = i + 1;
        return (
          <div
            key={n}
            id={`L${n}`}
            className="flex"
            style={{ backgroundColor: n === focusLine ? ink(0.12) : markedLines.has(n) ? ink(0.05) : undefined }}
          >
            <span className="shrink-0 pr-4 text-right select-none" style={{ width, color: ink(0.4) }}>
              {n}
            </span>
            <span className="whitespace-pre">{line || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}
