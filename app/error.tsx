"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

/** Catches unexpected rendering errors anywhere in the app. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="heading-serif text-5xl">Something went wrong</h1>
      <p className="max-w-md text-sm">An unexpected error happened while showing this page. Try again, or start over with another repo.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={reset} className="btn btn-solid">
          <RefreshCw className="size-4" /> Try again
        </button>
        <Link href="/" className="btn">
          <ArrowLeft className="size-4" /> Home
        </Link>
      </div>
    </main>
  );
}
