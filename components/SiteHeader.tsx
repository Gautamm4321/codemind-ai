import Link from "next/link";

export default function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-navy">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="logo-mark text-2xl leading-none">
          CodeMind <span className="logo-mark-sub align-middle text-sm">AI</span>
        </Link>
        {right}
      </div>
    </header>
  );
}
