import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="heading-serif text-6xl">Not found</h1>
      <p className="text-sm">That page or repository name isn&apos;t valid.</p>
      <Link href="/" className="btn">
        <ArrowLeft className="size-4" /> Back home
      </Link>
    </main>
  );
}
