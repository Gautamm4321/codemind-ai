// Browser-side fetch helpers. Turns API error bodies into readable Error messages.

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function readError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { code: string; message: string } };
    if (body.error) return new ApiError(body.error.code, body.error.message);
  } catch {
    /* not JSON */
  }
  return new ApiError("HTTP_ERROR", `Request failed (${res.status}).`);
}

export async function postJSON<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("NETWORK", "Network error. Check your connection.");
  }
  if (!res.ok) throw await readError(res);
  return (await res.json()) as T;
}

/** POSTs and calls onChunk with each piece of streamed text. Resolves with the full text. */
export async function postStream(
  url: string,
  body: unknown,
  onChunk: (fullText: string) => void,
  signal?: AbortSignal,
  onResponse?: (res: Response) => void,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await readError(res);
  if (!res.body) throw new ApiError("EMPTY", "Empty response.");
  onResponse?.(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onChunk(text);
  }
  return text;
}

/** Triggers a browser download of a text file. */
export function downloadText(filename: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copies text to the clipboard; resolves false if the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
