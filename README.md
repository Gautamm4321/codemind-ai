# CodeMind AI

**Live demo:** https://codemind-ai-delta.vercel.app

AI codebase intelligence for public GitHub repositories. Paste a repo URL to get:

- Repo metadata, a language breakdown and a filtered file tree
- An AI project overview: purpose, tech stack, architecture, and the files to read first
- A streamed AI explanation for any file
- Chat about the repo, with answers whose **file citations are verified against the real tree**. When the code doesn't support an answer, it says "not enough evidence".
- **Code review** of any file: prioritized issues (bug, security, performance, ...) with line numbers that are checked and clickable
- **README generator**: drafts a README.md from the repo's manifests and structure (TODOs instead of made-up details), with copy and download
- **Report export**: download the overview and all chat Q&A (with sources) as a Markdown report
- Large files are handled honestly: the AI sees the start and end of the file and the UI says exactly how much was analyzed

> Screenshots and a demo GIF go here (Week 4).

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend | Next.js Route Handlers (no separate server) |
| Validation | Zod (requests and AI JSON output) |
| Data | GitHub REST API with a server-side token |
| AI | Groq (Llama 3.3 70B) behind a provider layer; switch to Gemini with one env var |
| Code display | react-syntax-highlighter (custom monochrome navy theme) |
| Icons | Lucide React |
| Tests | Vitest |
| Deploy | Vercel |
| Database | None: client-held state and bounded requests |

## Getting started

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
# fill in GROQ_API_KEY and GITHUB_TOKEN
npm run dev                  # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (URL validation, file filter, citations, context builder, truncation, review, rate limit, report, AI fallback) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Project structure

```
app/
  page.tsx                     Landing page + URL input
  repo/[owner]/[name]/page.tsx Workspace page (validates params server-side)
  api/repo/route.ts            Metadata, languages, filtered tree (pinned to a commit SHA)
  api/file/route.ts            File contents (only paths that exist in the tree)
  api/overview/route.ts        AI overview, Zod-validated JSON
  api/explain/route.ts         Streamed file explanation
  api/chat/route.ts            Q&A with verified citations
  api/review/route.ts          Code-quality review, line numbers verified
  api/readme/route.ts          Streamed README.md draft
  error.tsx                    App-wide error page
components/                    RepoInput, FileTree, CodeViewer, OverviewPanel, ChatPanel, ReadmePanel, ...
lib/
  github.ts                    GitHub client, rate-limit handling
  ai.ts                        Provider-agnostic AI client (Groq / Gemini), JSON + streaming, model fallback
  validation.ts                URL parsing + Zod schemas
  file-filter.ts               What to hide (node_modules, lockfiles, binaries, huge files) + limits
  context-builder.ts           Relevant-file ranking, import following, context budgeting
  citations.ts                 Citation verification + evidence status
  truncate.ts                  Start+end truncation and line numbering for large files
  review.ts                    Review schema + line-number verification
  report.ts                    Markdown report builder
  rate-limit.ts                Per-IP limit on AI requests
  theme.ts                     Inline-style helpers that follow the theme tokens
types/                         Shared TypeScript types
__tests__/                     Vitest unit tests
```

## How it works

1. **Snapshot**: `/api/repo` resolves the default branch to a commit SHA. Every later request reads files at that exact SHA, so the tree, overview and chat always agree.
2. **Context budgeting**: chat ranks files by path match against the question (and recent turns), fetches the top few, follows their relative imports, re-ranks by keyword hits in the contents, then packs them into a fixed character budget (`MAX_CONTEXT_CHARS`).
3. **Citation verification**: the model must return JSON `{answer, citations, enoughEvidence}`. Each cited path is normalised and checked against the real tree; invalid ones are dropped and shown in "How this was answered".
4. **Honest fallback**: if the model reports insufficient evidence, the UI shows "Not enough evidence" instead of a guess. Answers with zero verifiable sources are flagged.
5. **Large files**: instead of only the first N characters, the model gets the beginning and the end with an explicit `[... OMITTED ...]` marker, plus a grounding rule never to guess what was omitted. The UI shows what percentage was analyzed.
6. **Verified line numbers**: code review sends numbered lines; any line the model cites outside the reviewed range is dropped, mirroring citation verification.
7. **Model fallback**: if the configured Groq model isn't available to the account, the next model is tried automatically and remembered.

## Security

- `GROQ_API_KEY` / `GITHUB_TOKEN` live only on the server (no `NEXT_PUBLIC_` prefix; `server-only` guards the modules that use them).
- **SSRF**: the submitted URL is never fetched. Owner/repo are extracted, validated with strict regexes, and used to build `api.github.com` URLs with each segment encoded.
- File paths are validated, then must exist in the repo tree before anything is fetched.
- **Prompt injection**: repo files are wrapped in `<file>` tags and the system prompt treats them as untrusted data.
- Limits on tree size, file size, files per question and total context.
- Per-IP rate limit on all AI routes (`AI_REQUESTS_PER_MINUTE`, default 20) to protect the API quota.
- Code from analyzed repos is never executed or installed.

## Theme

Two colors only: a beige background (`--color-beige`) everywhere, and one ink color (`--color-navy`) for all text, headings, lines and buttons. Both are defined once in `app/globals.css` as Tailwind theme tokens (`bg-beige`, `text-navy`, `border-navy`); the code highlighter and language bar read the same tokens via `lib/theme.ts`, so changing the two values re-themes the whole app. Lighter tones use ink opacity, never a new color.

## Deploying to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add `GROQ_API_KEY`, `GITHUB_TOKEN` (and optionally `AI_PROVIDER`, `GROQ_MODEL`, `MAX_CONTEXT_CHARS`, `AI_REQUESTS_PER_MINUTE`) as Environment Variables.
3. Deploy. AI routes set `maxDuration = 30`.

---

Built by Gautam Lakhani
