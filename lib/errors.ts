import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "INVALID_INPUT"
  | "REPO_NOT_FOUND"
  | "FILE_NOT_FOUND"
  | "FILE_TOO_LARGE"
  | "BINARY_FILE"
  | "GITHUB_RATE_LIMIT"
  | "GITHUB_ERROR"
  | "AI_RATE_LIMIT"
  | "AI_ERROR"
  | "AI_NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "AI_BAD_JSON"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Turns any thrown value into a safe JSON error response (never leaks stack traces or keys). */
export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: first } }, { status: 400 });
  }
  console.error("[codemind] unexpected error:", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}
