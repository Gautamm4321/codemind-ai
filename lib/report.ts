// Builds a Markdown report of everything the user generated for a repo. Pure (unit tested).

import type { Citation, ChatStatus, RepoData, RepoOverview } from "@/types";

export interface ReportChatEntry {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  status?: ChatStatus;
  error?: boolean;
}

export interface ReportInput {
  data: RepoData;
  overview: RepoOverview | null;
  chat: ReportChatEntry[];
  generatedAt?: Date;
}

const STATUS_LABEL: Record<ChatStatus, string> = {
  answered: "Verified sources",
  unverified: "No verifiable sources",
  insufficient_evidence: "Not enough evidence",
};

export function buildReport({ data, overview, chat, generatedAt = new Date() }: ReportInput): string {
  const { meta } = data;
  const out: string[] = [];

  out.push(`# ${meta.fullName}: CodeMind AI report`, "");
  out.push(`> Generated ${generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC · commit \`${data.ref.slice(0, 7)}\` · ${meta.htmlUrl}`, "");
  if (meta.description) out.push(meta.description, "");

  out.push("## Repository", "");
  out.push(`| | |`, `| --- | --- |`);
  out.push(`| Stars | ${meta.stars.toLocaleString("en")} |`);
  out.push(`| Forks | ${meta.forks.toLocaleString("en")} |`);
  out.push(`| License | ${meta.license ?? "Unknown"} |`);
  out.push(`| Default branch | ${meta.defaultBranch} |`);
  out.push(`| Files analyzed | ${data.files.length.toLocaleString("en")}${data.truncated ? " (tree truncated)" : ""} |`);
  if (data.languages.length) {
    out.push(`| Languages | ${data.languages.slice(0, 6).map((l) => `${l.name} ${l.percent}%`).join(", ")} |`);
  }
  out.push("");

  if (overview) {
    out.push("## Overview", "");
    out.push(`**Purpose:** ${overview.purpose}`, "", overview.summary, "");
    if (overview.techStack.length) out.push(`**Tech stack:** ${overview.techStack.join(", ")}`, "");
    if (overview.keyFiles.length) {
      out.push("### Read these first", "");
      overview.keyFiles.forEach((f, i) => out.push(`${i + 1}. \`${f.path}\`: ${f.reason}`));
      out.push("");
    }
    if (overview.architecture) out.push("### Architecture", "", overview.architecture, "");
  }

  const qa = chat.filter((e) => !e.error);
  if (qa.length) {
    out.push("## Questions & answers", "");
    let q = 0;
    for (const e of qa) {
      if (e.role === "user") {
        q++;
        out.push(`### Q${q}. ${e.content.replace(/\s+/g, " ").trim()}`, "");
      } else {
        if (e.status) out.push(`*${STATUS_LABEL[e.status]}*`, "");
        out.push(e.content.trim(), "");
        if (e.citations?.length) out.push(`**Sources:** ${e.citations.map((c) => `\`${c.path}\``).join(", ")}`, "");
      }
    }
  }

  if (!overview && !qa.length) out.push("_No overview or questions yet. Generate an overview or ask a question, then export again._", "");

  out.push("---", "", "_Generated with CodeMind AI. Citations were verified against the repository file tree._", "");
  return out.join("\n");
}

export function reportFilename(fullName: string): string {
  return `${fullName.replace(/[^A-Za-z0-9._-]+/g, "-")}-codemind-report.md`;
}
