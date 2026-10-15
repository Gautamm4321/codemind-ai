// Fitting large files into the model's context budget. Pure functions (unit tested).

export interface Truncated {
  text: string;
  truncated: boolean;
  shownChars: number;
  totalChars: number;
}

/**
 * Keeps the beginning (~70%) and end (~30%) of a long file and replaces the middle
 * with an explicit marker, so the model sees both the setup and the closing logic
 * (e.g. scripts at the bottom of an HTML page) and knows exactly what it did NOT see.
 * Cuts on line boundaries.
 */
export function truncateMiddle(content: string, maxChars: number): Truncated {
  const totalChars = content.length;
  if (totalChars <= maxChars) return { text: content, truncated: false, shownChars: totalChars, totalChars };

  const headBudget = Math.floor(maxChars * 0.7);
  const tailBudget = maxChars - headBudget;

  let head = content.slice(0, headBudget);
  const headCut = head.lastIndexOf("\n");
  if (headCut > headBudget * 0.5) head = head.slice(0, headCut);

  let tail = content.slice(totalChars - tailBudget);
  const tailCut = tail.indexOf("\n");
  if (tailCut >= 0 && tailCut < tailBudget * 0.5) tail = tail.slice(tailCut + 1);

  const omitted = totalChars - head.length - tail.length;
  const omittedLines = content.slice(head.length, totalChars - tail.length).split("\n").length - 1;
  const marker = `\n\n[... ${omitted.toLocaleString("en")} characters (~${omittedLines.toLocaleString("en")} lines) OMITTED: not shown to you ...]\n\n`;

  return { text: head + marker + tail, truncated: true, shownChars: head.length + tail.length, totalChars };
}

export interface NumberedText {
  text: string;
  /** Last line number included (lines after it were not shown to the model). */
  lastLine: number;
  totalLines: number;
  truncated: boolean;
}

/** Prefixes each line with its number ("12| code") until the budget runs out. */
export function withLineNumbers(content: string, maxChars: number): NumberedText {
  const lines = content.split("\n");
  const width = String(lines.length).length;
  const out: string[] = [];
  let used = 0;
  let lastLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = `${String(i + 1).padStart(width, " ")}| ${lines[i].length > 400 ? `${lines[i].slice(0, 400)} …` : lines[i]}`;
    if (used + line.length + 1 > maxChars && out.length > 0) break;
    out.push(line);
    used += line.length + 1;
    lastLine = i + 1;
  }
  return { text: out.join("\n"), lastLine, totalLines: lines.length, truncated: lastLine < lines.length };
}
