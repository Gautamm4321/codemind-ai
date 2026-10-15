import { describe, expect, it } from "vitest";
import { filePathSchema, parseRepoUrl } from "@/lib/validation";

describe("parseRepoUrl", () => {
  it.each([
    ["https://github.com/vercel/next.js", "vercel", "next.js"],
    ["github.com/vercel/next.js", "vercel", "next.js"],
    ["https://www.github.com/vercel/next.js/", "vercel", "next.js"],
    ["https://github.com/vercel/next.js.git", "vercel", "next.js"],
    ["https://github.com/vercel/next.js/tree/canary/packages", "vercel", "next.js"],
    ["  vercel/swr  ", "vercel", "swr"],
    ["http://github.com/a-b/c_d", "a-b", "c_d"],
  ])("accepts %s", (input, owner, name) => {
    expect(parseRepoUrl(input)).toEqual({ owner, name });
  });

  it.each([
    "",
    "not a url",
    "https://gitlab.com/owner/repo",
    "https://github.com.evil.com/owner/repo",
    "https://evil.com/github.com/owner/repo",
    "https://user:pass@github.com/owner/repo",
    "https://github.com:8080/owner/repo",
    "https://github.com/owner",
    "https://github.com/-bad/repo",
    "https://github.com/owner/..",
    "https://github.com/ow%2Fner/repo",
    "javascript:alert(1)",
    "file:///etc/passwd",
  ])("rejects %s", (input) => {
    expect(parseRepoUrl(input)).toBeNull();
  });
});

describe("filePathSchema", () => {
  it("accepts normal paths", () => {
    expect(filePathSchema.safeParse("src/app/page.tsx").success).toBe(true);
  });
  it.each(["../secret", "/etc/passwd", "a//b", "a/./b", "a/../../b", ""])("rejects %s", (p) => {
    expect(filePathSchema.safeParse(p).success).toBe(false);
  });
});
