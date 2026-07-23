import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  nextRefreshAt: number | null;
  intervalMs: number;
  onRefresh: () => void;
  loading: boolean;
}

const R = 9;
const C = 2 * Math.PI * R;

/**
 * Refresh button with an unobtrusive ring that depletes toward the next
 * auto-refresh. Quiet by default; the icon takes over on hover or while loading.
 */
export function RefreshCountdown({
  nextRefreshAt,
  intervalMs,
  onRefresh,
  loading,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = nextRefreshAt ? Math.max(0, nextRefreshAt - now) : 0;
  const progress =
    nextRefreshAt && intervalMs > 0
      ? Math.max(0, Math.min(1, remaining / intervalMs))
      : 0;
  const seconds = Math.ceil(remaining / 1000);
  const showRing = !loading && nextRefreshAt !== null;

  return (
    <button
      onClick={onRefresh}
      disabled={loading}
      aria-label="Refresh now"
      title={showRing ? `Refreshes in ${seconds}s` : "Refresh"}
      className="group text-muted-foreground hover:text-foreground hover:bg-accent relative flex size-8 items-center justify-center rounded-md transition-colors cursor-pointer"
    >
      {showRing && (
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute inset-0 size-full -rotate-90"
        >
          <circle
            cx="12"
            cy="12"
            r={R}
            fill="none"
            strokeWidth="1.5"
            className="stroke-border"
          />
          <circle
            cx="12"
            cy="12"
            r={R}
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="stroke-muted-foreground/45 group-hover:stroke-brand/60"
            style={{
              strokeDasharray: C,
              strokeDashoffset: C * (1 - progress),
              transition: "stroke-dashoffset 1s linear",
            }}
          />
        </svg>
      )}
      <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
    </button>
  );
}
