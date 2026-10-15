"use client";

import { CircleArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { ErrorNotice, Loading } from "./Notice";
import type { RepoOverview } from "@/types";

interface Props {
  overview: RepoOverview | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onOpenFile: (path: string) => void;
}

export default function OverviewPanel({ overview, loading, error, onGenerate, onOpenFile }: Props) {
  if (loading) return <Loading label="Reading the README, manifests and entry points…" />;
  if (error) return <ErrorNotice message={error} onRetry={onGenerate} />;

  if (!overview) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
        <Sparkles className="size-8" />
        <p className="heading-serif text-3xl">Project overview</p>
        <p className="max-w-md text-sm">Get the purpose, tech stack, architecture and the files to read first.</p>
        <button onClick={onGenerate} className="btn btn-solid">
          Generate overview <CircleArrowRight className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-6 sm:p-8">
        <div>
          <p className="label">Purpose</p>
          <p className="heading-serif mt-2 text-3xl leading-tight sm:text-4xl">{overview.purpose}</p>
          <p className="mt-4 leading-relaxed">{overview.summary}</p>
        </div>

        {overview.techStack.length > 0 && (
          <div className="border-t border-navy pt-6">
            <p className="label">Tech stack</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {overview.techStack.map((t) => (
                <li key={t} className="rounded-full border border-navy px-3 py-1 text-sm">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {overview.keyFiles.length > 0 && (
          <div className="border-t border-navy pt-6">
            <p className="label">Read these first</p>
            <ol className="mt-3 divide-y divide-navy/30 border-y border-navy/30">
              {overview.keyFiles.map((f, i) => (
                <li key={f.path}>
                  <button
                    onClick={() => onOpenFile(f.path)}
                    className="group flex w-full items-start gap-4 py-3 text-left hover:bg-navy/5"
                  >
                    <span className="heading-serif w-6 shrink-0 text-xl">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm font-medium underline-offset-4 group-hover:underline">
                        {f.path}
                      </span>
                      <span className="mt-0.5 block text-sm">{f.reason}</span>
                    </span>
                    <CircleArrowRight className="mt-0.5 size-4 shrink-0" />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {overview.architecture && (
          <div className="border-t border-navy pt-6">
            <p className="label">Architecture</p>
            <p className="mt-3 leading-relaxed">{overview.architecture}</p>
          </div>
        )}

        <button onClick={onGenerate} className="btn px-4 py-1.5 text-xs">
          <RefreshCw className="size-3.5" /> Regenerate
        </button>
      </div>
    </div>
  );
}
