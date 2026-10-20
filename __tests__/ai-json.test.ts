import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

describe("completeJSON recovery", () => {
  it("retries when Groq rejects cut-off JSON (400), and sends low reasoning effort to gpt-oss", async () => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.GROQ_MODEL = "openai/gpt-oss-20b";
    const bodies: Record<string, unknown>[] = [];
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      if (bodies.length === 1) {
        return new Response(
          JSON.stringify({ error: { message: "Failed to generate JSON.", code: "json_validate_failed" } }),
          { status: 400 },
        );
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Here you go:\n```json\n{"ok": true}\n```' } }] }), {
        status: 200,
      });
    }) as typeof fetch;

    const { completeJSON } = await import("@/lib/ai");
    const out = await completeJSON([{ role: "user", content: "hi" }], z.object({ ok: z.boolean() }), 1000);

    expect(out).toEqual({ ok: true });
    expect(bodies).toHaveLength(2);
    expect(bodies[0].reasoning_effort).toBe("low");
    expect(bodies[1].max_tokens).toBe(2000); // second attempt gets more room
  });

  it("extracts JSON surrounded by extra text", async () => {
    const { extractJson } = await import("@/lib/ai");
    expect(JSON.parse(extractJson('Sure! {"a": 1} hope that helps'))).toEqual({ a: 1 });
  });
});
