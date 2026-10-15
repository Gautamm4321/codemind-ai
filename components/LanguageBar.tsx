import { ink } from "@/lib/theme";
import type { LanguageShare } from "@/types";

// Navy at different strengths, so the bar stays inside the brand palette.
const SHADES = [1, 0.7, 0.5, 0.35, 0.22, 0.12];

export default function LanguageBar({ languages }: { languages: LanguageShare[] }) {
  if (!languages.length) return null;
  const top = languages.slice(0, 5);
  const rest = languages.slice(5).reduce((s, l) => s + l.percent, 0);
  const items = rest > 0 ? [...top, { name: "Other", bytes: 0, percent: Math.round(rest * 10) / 10 }] : top;

  return (
    <div className="w-full">
      <div className="flex h-2 w-full overflow-hidden rounded-full border border-navy" aria-hidden>
        {items.map((l, i) => (
          <span key={l.name} style={{ width: `${l.percent}%`, backgroundColor: ink(SHADES[i]) }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {items.map((l, i) => (
          <li key={l.name} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-navy" style={{ backgroundColor: ink(SHADES[i]) }} />
            {l.name} <span className="opacity-70">{l.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
