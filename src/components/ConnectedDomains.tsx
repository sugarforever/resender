import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, CircleX, RefreshCw } from "lucide-react";
import { api, errMessage } from "@/lib/api";
import type { Domain } from "@/lib/types";

export function ConnectedDomains() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDomains([]);
    async function load() {
      try {
        const all: Domain[] = [];
        const cursors = new Set<string>();
        let after: string | undefined;
        while (!cancelled) {
          const page = await api.listDomains(after);
          if (cancelled) return;
          all.push(...page.data);
          if (!page.has_more) break;
          const cursor = page.data[page.data.length - 1]?.id;
          if (!cursor || cursors.has(cursor)) {
            throw new Error(
              "Could not load the complete domain list. Try refreshing.",
            );
          }
          cursors.add(cursor);
          after = cursor;
        }
        if (!cancelled) setDomains(all);
      } catch (e) {
        if (!cancelled) setError(errMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [revision]);

  return (
    <section
      className="mx-4 mb-3"
      aria-label="Connected domains"
      aria-busy={loading}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
          Connected domains
        </h2>
        <button
          type="button"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
          aria-label="Refresh connected domains"
          className="text-muted-foreground hover:text-foreground rounded p-1 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div aria-live="polite">
        {loading ? (
          <p className="text-muted-foreground mt-1 text-xs">Loading domains…</p>
        ) : error ? (
          <p className="text-destructive mt-1 break-words text-xs">{error}</p>
        ) : domains.length === 0 ? (
          <p className="text-muted-foreground mt-1 text-xs">
            No domains configured in Resend.
          </p>
        ) : (
          <ul className="mt-1 max-h-40 space-y-2 overflow-y-auto">
            {domains.map((domain) => (
              <li key={domain.id} className="flex items-center gap-2 text-xs">
                {domain.status === "verified" ? (
                  <CheckCircle2
                    aria-label="Verified"
                    className="size-3.5 shrink-0 text-ok"
                  />
                ) : domain.status === "failed" ? (
                  <CircleX
                    aria-label="Failed"
                    className="size-3.5 shrink-0 text-destructive"
                  />
                ) : (
                  <CircleDashed
                    aria-label="Pending"
                    className="size-3.5 shrink-0 text-warn"
                  />
                )}
                <p
                  className="min-w-0 flex-1 truncate text-xs"
                  title={domain.name}
                >
                  {domain.name}
                </p>
                <p className="text-muted-foreground shrink-0 text-[10px] capitalize">
                  {domain.status.replace(/_/g, " ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        For reference only. Mailboxes show all mail available to this key.
      </p>
    </section>
  );
}
