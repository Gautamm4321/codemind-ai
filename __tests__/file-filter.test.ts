import { describe, expect, it } from "vitest";
import { detectLanguage, isIgnoredPath, looksBinary } from "@/lib/file-filter";

describe("isIgnoredPath", () => {
  it.each([
    "node_modules/react/index.js",
    "packages/app/node_modules/x/y.js",
    "package-lock.json",
    "web/yarn.lock",
    "public/logo.png",
    "assets/font.woff2",
    "dist/bundle.js",
    "static/app.min.js",
    "build/out.js.map",
    ".git/config",
    "api/__pycache__/x.pyc",
  ])("ignores %s", (p) => expect(isIgnoredPath(p)).toBe(true));

  it.each(["src/index.ts", "README.md", "package.json", "app/page.tsx", "lib/utils.py", "Dockerfile", "distribution/notes.md"])(
    "keeps %s",
    (p) => expect(isIgnoredPath(p)).toBe(false),
  );

  it("ignores very large files", () => {
    expect(isIgnoredPath("src/huge.ts", 5_000_000)).toBe(true);
  });
});

describe("looksBinary", () => {
  it("detects null bytes", () => expect(looksBinary("abc\u0000def")).toBe(true));
  it("passes normal text", () => expect(looksBinary("const x = 1;")).toBe(false));
});

describe("detectLanguage", () => {
  it("maps common extensions", () => {
    expect(detectLanguage("a/b.tsx")).toBe("tsx");
    expect(detectLanguage("main.py")).toBe("python");
    expect(detectLanguage("Dockerfile")).toBe("docker");
    expect(detectLanguage("LICENSE")).toBe("text");
  });
});
