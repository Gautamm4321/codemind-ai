"use client";

import { CircleArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { parseRepoUrl } from "@/lib/validation";

export default function RepoInput({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = parseRepoUrl(value);
    if (!id) {
      setError("Paste a public GitHub repo URL, like https://github.com/vercel/next.js");
      return;
    }
    setError(null);
    startTransition(() => router.push(`/repo/${id.owner}/${id.name}`));
  }

  return (
    <form onSubmit={submit} className="w-full" noValidate>
      <div
        className={`flex w-full flex-col gap-3 sm:flex-row sm:items-center ${compact ? "" : "sm:rounded-full sm:border sm:border-navy sm:p-1.5"}`}
      >
        <label htmlFor="repo-url" className="sr-only">
          GitHub repository URL
        </label>
        <input
          id="repo-url"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://github.com/owner/repo"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "repo-url-error" : undefined}
          className={`min-w-0 flex-1 rounded-full border border-navy bg-beige px-5 py-3 text-base text-navy outline-none ${
            compact ? "" : "sm:border-0 sm:py-2.5"
          }`}
        />
        <button type="submit" className="btn btn-solid py-3 sm:py-2.5" disabled={pending || !value.trim()}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Analyze
          {!pending && <CircleArrowRight className="size-4" />}
        </button>
      </div>
      {error && (
        <p id="repo-url-error" role="alert" className="mt-3 px-2 text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
