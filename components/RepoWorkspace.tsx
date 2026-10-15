"use client";

import { ArrowLeft, Download, ExternalLink, GitFork, Scale, Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatPanel, { type ChatEntry } from "./ChatPanel";
import CodeViewer, { type ExplainResult } from "./CodeViewer";
import FileTree from "./FileTree";
import LanguageBar from "./LanguageBar";
import { ErrorNotice, Loading } from "./Notice";
import OverviewPanel from "./OverviewPanel";
import ReadmePanel from "./ReadmePanel";
import SiteHeader from "./SiteHeader";
import { downloadText, postJSON } from "@/lib/client";
import { buildReport, reportFilename } from "@/lib/report";
import type { CodeReview, FileContent, RepoData, RepoOverview } from "@/types";

type Tab = "files" | "overview" | "code" | "chat" | "readme";

const fmt = (n: number) => Intl.NumberFormat("en", { notation: "compact" }).format(n);

export default function RepoWorkspace({ owner, name }: { owner: string; name: string }) {
  const [data, setData] = useState<RepoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [tab, setTab] = useState<Tab>("overview");
  const [selected, setSelected] = useState<string | null>(null);

  const [overview, setOverview] = useState<RepoOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [readme, setReadme] = useState<string | null>(null);

  // Client-held caches (no database): file contents and explanations per path.
  const fileCache = useRef(new Map<string, FileContent>()).current;
  const explainCache = useRef(new Map<string, ExplainResult>()).current;
  const reviewCache = useRef(new Map<string, CodeReview>()).current;

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    postJSON<RepoData>("/api/repo", { owner, name }, ctrl.signal)
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ctrl.abort();
  }, [owner, name, attempt]);

  const repo = useMemo(() => (data ? { owner: data.meta.owner, name: data.meta.name, ref: data.ref } : null), [data]);
  const filePaths = useMemo(() => new Set(data?.files.map((f) => f.path)), [data]);

  const generateOverview = useCallback(async () => {
    if (!repo) return;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      setOverview(await postJSON<RepoOverview>("/api/overview", repo));
    } catch (e) {
      setOverviewError((e as Error).message);
    } finally {
      setOverviewLoading(false);
    }
  }, [repo]);

  // Generate the overview automatically once the repo has loaded.
  const autoRan = useRef(false);
  useEffect(() => {
    if (repo && !autoRan.current) {
      autoRan.current = true;
      generateOverview();
    }
  }, [repo, generateOverview]);

  const openFile = useCallback(
    (path: string) => {
      if (!filePaths.has(path)) return;
      setSelected(path);
      setTab("code");
    },
    [filePaths],
  );

  if (error) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl p-6">
          <ErrorNotice message={error} onRetry={() => setAttempt((n) => n + 1)} />
          <Link href="/" className="btn mx-4">
            <ArrowLeft className="size-4" /> Try another repo
          </Link>
        </div>
      </Shell>
    );
  }
  if (!data || !repo) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl p-6">
          <Loading label={`Fetching ${owner}/${name} from GitHub…`} />
        </div>
      </Shell>
    );
  }

  const { meta } = data;
  const tabs: { id: Tab; label: string; mobileOnly?: boolean }[] = [
    { id: "files", label: "Files", mobileOnly: true },
    { id: "overview", label: "Overview" },
    { id: "code", label: "Code" },
    { id: "chat", label: "Chat" },
    { id: "readme", label: "README" },
  ];

  const exportReport = () => {
    const md = buildReport({
      data,
      overview,
      chat: chat.map((e) => ({ role: e.role, content: e.content, error: e.error, citations: e.meta?.citations, status: e.meta?.status })),
    });
    downloadText(reportFilename(meta.fullName), md);
  };

  return (
    <Shell>
      {/* Repo summary */}
      <section className="border-b border-navy">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm">{meta.owner}</p>
            <h1 className="heading-serif truncate text-4xl leading-tight sm:text-5xl">{meta.name}</h1>
            {meta.description && <p className="mt-1 line-clamp-2 max-w-2xl text-sm">{meta.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Pill icon={<Star className="size-3.5" />}>{fmt(meta.stars)} stars</Pill>
              <Pill icon={<GitFork className="size-3.5" />}>{fmt(meta.forks)} forks</Pill>
              {meta.license && <Pill icon={<Scale className="size-3.5" />}>{meta.license}</Pill>}
              <a href={meta.htmlUrl} target="_blank" rel="noreferrer" className="btn px-3 py-1 text-xs">
                GitHub <ExternalLink className="size-3.5" />
              </a>
              <button
                onClick={exportReport}
                className="btn px-3 py-1 text-xs"
                title="Download the overview and chat Q&A as a Markdown report"
              >
                <Download className="size-3.5" /> Export report
              </button>
            </div>
          </div>
          <div className="hidden w-full sm:block lg:max-w-md">
            <LanguageBar languages={data.languages} />
            <p className="mt-2 text-xs opacity-70">
              {data.files.length.toLocaleString()} files shown
              {data.skippedCount > 0 && ` · ${data.skippedCount.toLocaleString()} hidden (dependencies, binaries, lockfiles)`}
              {data.truncated && " · tree truncated (very large repo)"}
            </p>
          </div>
        </div>
      </section>

      {/* Workspace */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-navy lg:block xl:w-80">
          <FileTree files={data.files} selected={selected} onSelect={openFile} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <nav className="flex gap-1 overflow-x-auto border-b border-navy px-3 py-2" aria-label="Workspace views">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm whitespace-nowrap ${t.mobileOnly ? "lg:hidden" : ""} ${
                  tab === t.id ? "bg-navy text-beige" : "hover:bg-navy/10"
                }`}
              >
                {t.label}
                {t.id === "code" && selected && <span className="ml-1.5 opacity-70">· {selected.split("/").pop()}</span>}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1">
            {tab === "files" && (
              <div className="h-full lg:hidden">
                <FileTree files={data.files} selected={selected} onSelect={openFile} />
              </div>
            )}
            {tab === "overview" && (
              <OverviewPanel
                overview={overview}
                loading={overviewLoading}
                error={overviewError}
                onGenerate={generateOverview}
                onOpenFile={openFile}
              />
            )}
            <div className={tab === "code" ? "h-full" : "hidden"}>
              <CodeViewer repo={repo} path={selected} fileCache={fileCache} explainCache={explainCache} reviewCache={reviewCache} />
            </div>
            <div className={tab === "readme" ? "h-full" : "hidden"}>
              <ReadmePanel repo={repo} text={readme} setText={setReadme} />
            </div>
            <div className={tab === "chat" ? "h-full" : "hidden"}>
              <ChatPanel repo={repo} activeFile={selected} entries={chat} setEntries={setChat} onOpenFile={openFile} />
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader
        right={
          <Link href="/" className="btn px-4 py-1.5 text-xs">
            <ArrowLeft className="size-3.5" /> New repo
          </Link>
        }
      />
      {children}
    </div>
  );
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-navy px-3 py-1">
      {icon}
      {children}
    </span>
  );
}
