"use client";

import { Check, CircleArrowRight, Copy, Download, FileText, LoaderCircle, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ErrorNotice } from "./Notice";
import { copyText, downloadText, postStream } from "@/lib/client";
import type { RepoRef } from "./CodeViewer";

interface Props {
  repo: RepoRef;
  text: string | null;
  setText: (t: string | null) => void;
}

/** Generates a README.md draft for the analyzed repo, with preview, copy and download. */
export default function ReadmePanel({ repo, text, setText }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"preview" | "markdown">("preview");
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    setText("");
    try {
      const full = await postStream("/api/readme", repo, setText, ctrl.signal);
      setText(cleanMarkdown(full));
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        setText(null);
      }
    } finally {
      if (abortRef.current === ctrl) setBusy(false);
    }
  }

  if (text === null && !busy) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
        {error && <ErrorNotice message={error} />}
        <FileText className="size-8" />
        <p className="heading-serif text-3xl">README generator</p>
        <p className="max-w-md text-sm">
          Draft a README.md from the repo&apos;s manifests, entry points and structure. Unknown details are left as TODOs instead
          of being made up.
        </p>
        <button onClick={generate} className="btn btn-solid">
          Generate README <CircleArrowRight className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-navy px-4 py-3">
        <div className="flex rounded-full border border-navy p-0.5 text-xs">
          {(["preview", "markdown"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 capitalize ${view === v ? "bg-navy text-beige" : ""}`}
              aria-pressed={view === v}
            >
              {v}
            </button>
          ))}
        </div>
        {busy && (
          <span className="flex items-center gap-1.5 text-xs">
            <LoaderCircle className="size-3.5 animate-spin" /> Writing…
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            className="btn px-3 py-1.5 text-xs"
            disabled={busy || !text}
            onClick={async () => {
              if (text && (await copyText(text))) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
          </button>
          <button className="btn px-3 py-1.5 text-xs" disabled={busy || !text} onClick={() => text && downloadText("README.md", text)}>
            <Download className="size-3.5" /> README.md
          </button>
          <button className="btn px-3 py-1.5 text-xs" disabled={busy} onClick={generate}>
            <RefreshCw className="size-3.5" /> Regenerate
          </button>
        </div>
      </div>
      {error && <ErrorNotice message={error} onRetry={generate} />}
      <div className="min-h-0 flex-1 overflow-auto">
        {view === "preview" ? (
          <article className="prose-navy mx-auto max-w-3xl p-6 sm:p-8">
            <ReactMarkdown>{text ?? ""}</ReactMarkdown>
          </article>
        ) : (
          <pre className="p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">{text}</pre>
        )}
      </div>
    </div>
  );
}

/** Some models wrap the whole document in ```markdown fences; strip them. */
function cleanMarkdown(s: string): string {
  return s
    .trim()
    .replace(/^```(?:markdown|md)?\s*\n/i, "")
    .replace(/\n```\s*$/, "")
    .trim();
}
