import Link from "next/link";
import { CircleArrowRight } from "lucide-react";
import RepoInput from "@/components/RepoInput";
import SiteHeader from "@/components/SiteHeader";

const EXAMPLES = ["vercel/swr", "pallets/flask", "sindresorhus/ky", "expressjs/express"];

const FEATURES = [
  { n: "01", title: "Map the repo", body: "Metadata, language breakdown and a clean file tree, without the node_modules noise." },
  { n: "02", title: "Understand it fast", body: "An AI overview of purpose, stack and the files to read first, plus a plain-English explanation of any file." },
  { n: "03", title: "Ask with sources", body: "Chat about the code. Every cited file is checked against the real tree, and it says so when evidence is missing." },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={<span className="rounded-full border border-navy px-3 py-1 text-xs">Public repos only</span>}
      />

      <main className="flex-1">
        <section className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-16 pb-14 text-center sm:px-6 sm:pt-24">
          <p className="mb-6 text-sm font-medium tracking-wide">AI codebase intelligence</p>
          <h1 className="heading-serif text-6xl leading-[0.95] sm:text-8xl md:text-9xl">CodeMind</h1>
          <p className="mt-6 max-w-xl text-base sm:text-lg">
            Paste a public GitHub repository and get an overview, file-by-file explanations, and answers with verified citations.
          </p>

          <div className="mt-10 w-full max-w-2xl">
            <RepoInput />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm">Try</span>
            {EXAMPLES.map((ex) => {
              const [o, n] = ex.split("/");
              return (
                <Link key={ex} href={`/repo/${o}/${n}`} className="btn px-4 py-1.5 text-xs">
                  {ex}
                  <CircleArrowRight className="size-3.5" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="border-t border-navy">
          <div className="mx-auto grid max-w-6xl md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.n} className={`px-6 py-10 ${i > 0 ? "border-t border-navy md:border-t-0 md:border-l" : ""}`}>
                <p className="text-sm font-medium">{f.n}</p>
                <h2 className="heading-serif mt-3 text-3xl">{f.title}</h2>
                <p className="mt-3 text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-navy">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-5 text-xs sm:flex-row sm:justify-between">
          <span>Built by Gautam Lakhani</span>
          <span>Next.js · Groq · GitHub API</span>
        </div>
      </footer>
    </div>
  );
}
