import localFont from "next/font/local";

// Typography matches the Artisun website:
//  - PP Editorial New (regular, upright) for headings
//  - Suisse Int'l (regular + medium) for body text, labels and UI
// The CodeMind AI logo keeps its own font (see .logo-mark in globals.css).

export const ppEditorialNew = localFont({
  src: "../public/fonts/PPEditorialNew-Regular.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-editorial",
  fallback: ["Georgia", "serif"],
  display: "swap",
});

export const suisseIntl = localFont({
  src: [
    { path: "../public/fonts/SuisseIntl-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/SuisseIntl-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-suisse",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
  display: "swap",
});
