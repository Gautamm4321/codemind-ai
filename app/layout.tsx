import type { Metadata } from "next";
// Logo-only fonts (the CodeMind AI wordmark keeps its original look)
import "@fontsource-variable/inter";
import "@fontsource-variable/playfair-display/wght-italic.css";
import { ppEditorialNew, suisseIntl } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeMind AI",
  description: "Understand any public GitHub repository with AI, backed by verified file citations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${ppEditorialNew.variable} ${suisseIntl.variable}`}>
      <body className="min-h-screen bg-beige font-sans text-navy antialiased">{children}</body>
    </html>
  );
}
