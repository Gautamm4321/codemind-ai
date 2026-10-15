// Simple in-memory, per-IP sliding-window rate limit for the AI routes.
// Protects the Groq quota from one visitor hammering the API. On serverless hosts each
// instance has its own memory, so this is best-effort (good enough for a portfolio app).

import { AppError } from "./errors";

const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false as const, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return { ok: true as const, remaining: limit - recent.length };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
}

/** Throws a 429 AppError if this client made too many AI requests in the last minute. */
export function enforceAiRateLimit(req: Request) {
  const limit = Number(process.env.AI_REQUESTS_PER_MINUTE) || 20;
  const result = checkRateLimit(`ai:${clientIp(req)}`, limit, 60_000);
  if (!result.ok) {
    throw new AppError("RATE_LIMITED", `Too many AI requests. Please wait ${result.retryAfterSec}s and try again.`, 429);
  }
}

/** Test helper */
export function _resetRateLimits() {
  hits.clear();
}
