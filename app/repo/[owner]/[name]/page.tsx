import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RepoWorkspace from "@/components/RepoWorkspace";
import { repoIdSchema } from "@/lib/validation";

type Params = Promise<{ owner: string; name: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { owner, name } = await params;
  return { title: `${owner}/${name} · CodeMind AI` };
}

export default async function RepoPage({ params }: { params: Params }) {
  const raw = await params;
  const parsed = repoIdSchema.safeParse({ owner: decodeURIComponent(raw.owner), name: decodeURIComponent(raw.name) });
  if (!parsed.success) notFound();

  const { owner, name } = parsed.data;
  // key resets all client state when navigating between repos
  return <RepoWorkspace key={`${owner}/${name}`} owner={owner} name={name} />;
}
