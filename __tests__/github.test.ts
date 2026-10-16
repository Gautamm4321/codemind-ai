import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("GitHub token fallback", () => {
  it("retries without the token when GitHub rejects it, and stays tokenless afterwards", async () => {
    process.env.GITHUB_TOKEN = "github_pat_revoked";
    const auth: (string | null)[] = [];
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const a = new Headers(init?.headers).get("authorization");
      auth.push(a);
      if (a) return new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 });
      return new Response(JSON.stringify({ TypeScript: 100 }), { status: 200 });
    }) as typeof fetch;

    const { getLanguages } = await import("@/lib/github");
    expect(await getLanguages({ owner: "o", name: "r" })).toEqual([{ name: "TypeScript", bytes: 100, percent: 100 }]);
    await getLanguages({ owner: "o", name: "r" });
    expect(auth).toEqual(["Bearer github_pat_revoked", null, null]);
  });
});
