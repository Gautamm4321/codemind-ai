import { beforeEach, describe, expect, it } from "vitest";
import { packFiles } from "@/lib/context-builder";
import { _resetRateLimits, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { buildReport, reportFilename } from "@/lib/report";
import { sanitizeIssues } from "@/lib/review";
import { truncateMiddle, withLineNumbers } from "@/lib/truncate";
import type { RepoData } from "@/types";

describe("truncateMiddle", () => {
  const big = Array.from({ length: 2000 }, (_, i) => `line ${i + 1}`).join("\n");

  it("leaves small files untouched", () => {
    expect(truncateMiddle("hello", 100)).toEqual({ text: "hello", truncated: false, shownChars: 5, totalChars: 5 });
  });

  it("keeps the start and the end with an explicit OMITTED marker", () => {
    const t = truncateMiddle(big, 2000);
    expect(t.truncated).toBe(true);
    expect(t.text.startsWith("line 1\n")).toBe(true);
    expect(t.text.endsWith("line 2000")).toBe(true);
    expect(t.text).toMatch(/OMITTED/);
    expect(t.shownChars).toBeLessThanOrEqual(2000);
    expect(t.totalChars).toBe(big.length);
  });

  it("cuts on line boundaries", () => {
    const t = truncateMiddle(big, 2000);
    const [head, tail] = t.text.split(/\n\n\[\.\.\..*\.\.\.\]\n\n/);
    expect(head.split("\n").every((l) => /^line \d+$/.test(l))).toBe(true);
    expect(tail.split("\n").every((l) => /^line \d+$/.test(l))).toBe(true);
  });
});

describe("withLineNumbers", () => {
  it("numbers every line when it fits", () => {
    const n = withLineNumbers("a\nb\nc", 1000);
    expect(n.text).toBe("1| a\n2| b\n3| c");
    expect(n).toMatchObject({ lastLine: 3, totalLines: 3, truncated: false });
  });

  it("stops at the budget and reports the last line shown", () => {
    const n = withLineNumbers(Array(100).fill("xxxxxxxxxx").join("\n"), 200);
    expect(n.truncated).toBe(true);
    expect(n.lastLine).toBeGreaterThan(0);
    expect(n.lastLine).toBeLessThan(100);
    expect(n.text.split("\n")).toHaveLength(n.lastLine);
  });
});

describe("sanitizeIssues", () => {
  it("drops line numbers outside the reviewed range and sorts by severity", () => {
    const { issues, droppedLines } = sanitizeIssues(
      [
        { severity: "low", category: "readability", title: "Naming", detail: "x", line: 3 },
        { severity: "high", category: "security", title: "XSS", detail: "y", line: 999 },
        { severity: "medium", category: "bug", title: "Off by one", detail: "z", line: 0 },
        { severity: "high", category: "bug", title: "Null deref", detail: "w", line: 10 },
      ],
      50,
    );
    expect(droppedLines).toBe(2);
    expect(issues.map((i) => [i.severity, i.line])).toEqual([
      ["high", 10],
      ["high", null],
      ["medium", null],
      ["low", 3],
    ]);
  });
});

describe("packFiles with large files", () => {
  it("keeps the end of a large file too", () => {
    const content = `START\n${"x\n".repeat(5000)}END`;
    const { text } = packFiles([{ path: "big.html", content, size: content.length, language: "markup" }], 2000);
    expect(text).toContain("START");
    expect(text).toContain("END");
    expect(text).toContain("OMITTED");
  });
});

describe("rate limit", () => {
  beforeEach(() => _resetRateLimits());

  it("allows up to the limit, then blocks with a retry time", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(checkRateLimit("ip", 3, 60_000, now + i).ok).toBe(true);
    const blocked = checkRateLimit("ip", 3, 60_000, now + 10);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("frees up after the window passes", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("ip", 3, 60_000, 0);
    expect(checkRateLimit("ip", 3, 60_000, 60_001).ok).toBe(true);
  });

  it("reads the first forwarded IP", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }))).toBe("1.2.3.4");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});

describe("buildReport", () => {
  const data: RepoData = {
    meta: {
      owner: "o", name: "r", fullName: "o/r", description: "A repo", htmlUrl: "https://github.com/o/r", defaultBranch: "main",
      stars: 1200, forks: 3, openIssues: 0, license: "MIT", topics: [], updatedAt: "",
    },
    languages: [{ name: "TypeScript", bytes: 1, percent: 100 }],
    files: [{ path: "src/index.ts", size: 10 }],
    ref: "a".repeat(40),
    truncated: false,
    skippedCount: 0,
  };

  it("includes overview, Q&A with sources, and skips errored messages", () => {
    const md = buildReport({
      data,
      generatedAt: new Date("2026-01-01T00:00:00Z"),
      overview: { purpose: "Does X", summary: "Sum", techStack: ["TS"], keyFiles: [{ path: "src/index.ts", reason: "entry" }], architecture: "Arch" },
      chat: [
        { role: "user", content: "How does it start?" },
        { role: "assistant", content: "From index.", citations: [{ path: "src/index.ts" }], status: "answered" },
        { role: "user", content: "Broken?" },
        { role: "assistant", content: "Network error", error: true },
      ],
    });
    expect(md).toContain("# o/r: CodeMind AI report");
    expect(md).toContain("**Purpose:** Does X");
    expect(md).toContain("1. `src/index.ts`: entry");
    expect(md).toContain("### Q1. How does it start?");
    expect(md).toContain("**Sources:** `src/index.ts`");
    expect(md).toContain("*Verified sources*");
    expect(md).not.toContain("Network error");
    expect(md).toContain("| Stars | 1,200 |");
  });

  it("makes a safe filename", () => {
    expect(reportFilename("vercel/next.js")).toBe("vercel-next.js-codemind-report.md");
  });
});
