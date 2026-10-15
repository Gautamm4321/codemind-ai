import type { CSSProperties } from "react";
import { ink } from "@/lib/theme";

// Monochrome syntax theme: beige background, ink-colored text. Tokens are distinguished by
// weight and opacity instead of extra colors (no italics), so the brand palette stays intact.
const NAVY = ink();

const base: CSSProperties = {
  color: NAVY,
  background: "transparent",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "13px",
  lineHeight: 1.6,
  textAlign: "left",
  whiteSpace: "pre",
  tabSize: 2,
};

export const navyCodeTheme: Record<string, CSSProperties> = {
  'code[class*="language-"]': base,
  'pre[class*="language-"]': { ...base, margin: 0, padding: "1rem", overflow: "auto" },
  comment: { color: ink(0.5) },
  prolog: { color: ink(0.5) },
  doctype: { color: ink(0.5) },
  cdata: { color: ink(0.5) },
  punctuation: { color: ink(0.65) },
  keyword: { fontWeight: 700 },
  "atrule": { fontWeight: 700 },
  builtin: { fontWeight: 600 },
  boolean: { fontWeight: 600 },
  important: { fontWeight: 700 },
  function: { fontWeight: 600 },
  "class-name": { fontWeight: 700 },
  string: { color: ink(0.78) },
  char: { color: ink(0.78) },
  "attr-value": { color: ink(0.78) },
  regex: { color: ink(0.78) },
  number: { color: ink(0.85) },
  operator: { color: ink(0.7) },
  tag: { fontWeight: 600 },
  "attr-name": { color: ink(0.85) },
  property: { color: ink(0.9) },
  variable: { color: NAVY },
  deleted: { textDecoration: "line-through" },
  inserted: { textDecoration: "underline" },
};
