import { LoaderCircle, TriangleAlert } from "lucide-react";

export function Loading({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-sm">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="m-4 flex flex-col items-start gap-3 rounded-2xl border border-navy p-4 text-sm sm:flex-row sm:items-center">
      <TriangleAlert className="size-5 shrink-0" />
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn px-4 py-1.5 text-xs">
          Try again
        </button>
      )}
    </div>
  );
}
