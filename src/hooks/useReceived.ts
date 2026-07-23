import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMessage } from "@/lib/api";
import { notifyNewEmails } from "@/lib/notify";
import type { ReceivedEmail } from "@/lib/types";

interface Options {
  configured: boolean;
  pollIntervalSec: number;
}

/**
 * Loads the inbox, polls it on an interval, tracks unread state, and fires a
 * system notification whenever new mail arrives (after the initial load).
 */
export function useReceived({ configured, pollIntervalSec }: Options) {
  const [emails, setEmails] = useState<ReceivedEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const refresh = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!configured) return;
      if (!silent) setLoading(true);
      try {
        const res = await api.listReceived(50);
        const data = res.data ?? [];

        const fresh = data.filter((e) => !knownIds.current.has(e.id));
        data.forEach((e) => knownIds.current.add(e.id));

        if (!firstLoad.current && fresh.length > 0) {
          setUnreadIds((prev) => {
            const next = new Set(prev);
            fresh.forEach((e) => next.add(e.id));
            return next;
          });
          void notifyNewEmails(fresh);
        }
        firstLoad.current = false;

        setEmails(data);
        setError(null);
      } catch (e) {
        setError(errMessage(e));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [configured]
  );

  // Initial load + polling. Re-runs when the interval or configured-state changes.
  useEffect(() => {
    if (!configured) return;
    void refresh();
    const id = window.setInterval(
      () => void refresh({ silent: true }),
      Math.max(30, pollIntervalSec) * 1000
    );
    return () => window.clearInterval(id);
  }, [configured, pollIntervalSec, refresh]);

  const markRead = useCallback((id: string) => {
    setUnreadIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => setUnreadIds(new Set()), []);

  return {
    emails,
    loading,
    error,
    unreadIds,
    unreadCount: unreadIds.size,
    refresh,
    markRead,
    markAllRead,
  };
}
