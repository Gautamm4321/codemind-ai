import { describe, expect, it } from "vitest";
import { decideStatus, verifyCitations } from "@/lib/citations";
import { packFiles, rankFilesByPath, resolveRelativeImports } from "@/lib/context-builder";

const tree = new Set(["src/index.ts", "src/lib/auth.ts", "README.md"]);

describe("verifyCitations", () => {
  it("keeps real paths and drops hallucinated ones", () => {
    const { valid, dropped } = verifyCitations(
      [{ path: "src/index.ts" }, { path: "src/made-up.ts" }, { path: "README.md", reason: "docs" }],
      tree,
    );
    expect(valid.map((c) => c.path)).toEqual(["src/index.ts", "README.md"]);
    expect(dropped).toEqual(["src/made-up.ts"]);
  });

  it("normalises ./ prefixes, backticks and line anchors", () => {
    const { valid } = verifyCitations(
      [{ path: "./src/index.ts" }, { path: "`src/lib/auth.ts`" }, { path: "src/lib/auth.ts#L10-L20" }, { path: "README.md:4" }],
      tree,
    );
    expect(valid.map((c) => c.path)).toEqual(["src/index.ts", "src/lib/auth.ts", "README.md"]);
  });
});

describe("decideStatus", () => {
  it("handles each case", () => {
    expect(decideStatus(true, 2)).toBe("answered");
    expect(decideStatus(true, 0)).toBe("unverified");
    expect(decideStatus(false, 3)).toBe("insufficient_evidence");
  });
});

describe("context builder", () => {
  it("ranks files whose names match the question first", () => {
    const files = [
      { path: "src/index.ts", size: 100 },
      { path: "src/lib/auth.ts", size: 100 },
      { path: "src/lib/db.ts", size: 100 },
    ];
    expect(rankFilesByPath(files, "How does authentication / auth work?")[0].path).toBe("src/lib/auth.ts");
  });

  it("resolves relative imports to tree paths", () => {
    const file = { path: "src/index.ts", content: `import { login } from "./lib/auth";\nimport x from "react";`, size: 1, language: "typescript" };
    expect(resolveRelativeImports(file, tree)).toEqual(["src/lib/auth.ts"]);
  });

  it("respects the character budget", () => {
    const big = { path: "a.ts", content: "x".repeat(10_000), size: 10_000, language: "typescript" };
    const { text, included } = packFiles([big, { ...big, path: "b.ts" }], 3000);
    expect(text.length).toBeLessThan(3200);
    expect(included).toEqual(["a.ts"]);
  });
});
