import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("AI provider fallback", () => {
  it("skips a model the account can't use and remembers the working one", async () => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.GROQ_MODEL = "llama-3.3-70b-versatile";
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const model = JSON.parse(String(init?.body)).model as string;
      seen.push(model);
      if (model === "llama-3.3-70b-versatile") {
        return new Response(JSON.stringify({ error: { message: "The model does not exist or you do not have access to it.", code: "model_not_found" } }), { status: 404 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    }) as typeof fetch;

    const { complete } = await import("@/lib/ai");
    expect(await complete([{ role: "user", content: "hi" }])).toBe("ok");
    expect(await complete([{ role: "user", content: "hi" }])).toBe("ok");
    expect(seen).toEqual(["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama-3.1-8b-instant"]);
  });
});
