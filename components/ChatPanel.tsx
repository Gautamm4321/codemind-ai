"use client";

import { CircleHelp, FileText, LoaderCircle, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { postJSON } from "@/lib/client";
import type { ChatResponse } from "@/types";
import type { RepoRef } from "./CodeViewer";

export interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  meta?: Omit<ChatResponse, "answer">;
  error?: boolean;
}

const SUGGESTIONS = [
  "What does this project do and where does it start?",
  "How is the code organised?",
  "How are errors handled?",
  "Where are the tests and how do I run them?",
];

interface Props {
  repo: RepoRef;
  activeFile: string | null;
  entries: ChatEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  onOpenFile: (path: string) => void;
}

export default function ChatPanel({ repo, activeFile, entries, setEntries, onOpenFile }: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, sending]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;

    const history = [...entries.filter((e) => !e.error), { role: "user" as const, content: question }];
    setEntries((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setSending(true);

    try {
      const res = await postJSON<ChatResponse>("/api/chat", {
        ...repo,
        activeFile: activeFile ?? undefined,
        messages: history.slice(-10).map((e) => ({ role: e.role, content: e.content.slice(0, 4000) })),
      });
      const { answer, ...meta } = res;
      setEntries((prev) => [...prev, { role: "assistant", content: answer, meta }]);
    } catch (e) {
      setEntries((prev) => [...prev, { role: "assistant", content: (e as Error).message, error: true }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
          {entries.length === 0 && (
            <div className="py-6 text-center">
              <p className="heading-serif text-3xl">Ask about this repo</p>
              <p className="mt-2 text-sm">Answers cite real files. If the code doesn&apos;t show it, CodeMind says so.</p>
              <div className="mt-6 flex flex-col items-stretch gap-2 sm:items-center">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="btn text-left text-xs sm:text-sm">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {entries.map((e, i) =>
            e.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-sm whitespace-pre-wrap text-beige">
                  {e.content}
                </p>
              </div>
            ) : (
              <AssistantMessage key={i} entry={e} onOpenFile={onOpenFile} />
            ),
          )}

          {sending && (
            <div role="status" className="flex items-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" /> Finding relevant files and reading them…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-navy p-3 sm:p-4"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border border-navy p-1.5">
          <label htmlFor="chat-input" className="sr-only">
            Ask a question
          </label>
          <textarea
            id="chat-input"
            rows={1}
            value={input}
            maxLength={2000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={activeFile ? `Ask about the repo or ${activeFile.split("/").pop()}…` : "Ask about this repository…"}
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button type="submit" disabled={sending || !input.trim()} className="btn btn-solid size-10 shrink-0 p-0" aria-label="Send">
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function AssistantMessage({ entry, onOpenFile }: { entry: ChatEntry; onOpenFile: (p: string) => void }) {
  if (entry.error) {
    return <p className="rounded-2xl border border-dashed border-navy px-4 py-3 text-sm">{entry.content}</p>;
  }
  const meta = entry.meta;
  return (
    <div className="space-y-3">
      {meta && <StatusBadge status={meta.status} />}
      <div className="prose-navy">
        <ReactMarkdown>{entry.content}</ReactMarkdown>
      </div>

      {meta && meta.citations.length > 0 && (
        <div>
          <p className="label mb-2">Sources</p>
          <div className="flex flex-wrap gap-2">
            {meta.citations.map((c) => (
              <button
                key={c.path}
                onClick={() => onOpenFile(c.path)}
                title={c.reason}
                className="btn max-w-full px-3 py-1 font-mono text-xs"
              >
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{c.path}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {meta && (meta.droppedCitations.length > 0 || meta.filesRead.length > 0) && (
        <details className="text-xs">
          <summary className="cursor-pointer select-none">How this was answered</summary>
          <div className="mt-2 space-y-1 pl-4">
            {meta.filesRead.length > 0 && <p>Files read: {meta.filesRead.join(", ")}</p>}
            {meta.droppedCitations.length > 0 && (
              <p>Removed unverified citations (not in the repo): {meta.droppedCitations.join(", ")}</p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: NonNullable<ChatEntry["meta"]>["status"] }) {
  const map = {
    answered: { icon: ShieldCheck, label: "Verified sources" },
    unverified: { icon: ShieldAlert, label: "No verifiable sources, treat with caution" },
    insufficient_evidence: { icon: CircleHelp, label: "Not enough evidence" },
  } as const;
  const { icon: Icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-navy px-2.5 py-0.5 text-xs ${status === "answered" ? "bg-navy text-beige" : ""}`}>
      <Icon className="size-3.5" /> {label}
    </span>
  );
}
