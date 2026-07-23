import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "@/lib/api";
import { ensureNotificationPermission } from "@/lib/notify";
import type { ReceivedEmail } from "@/lib/types";

interface Options {
  configured: boolean;
  pollIntervalSec: number;
}

interface InboxData {
  emails: ReceivedEmail[];
  newIds: string[];
}

/**
 * Drives the inbox from the Rust background poller. The poller fetches on its
 * own tokio interval (so it keeps running when the window is backgrounded),
 * sends system notifications itself, and emits `inbox-data` events that we turn
 * into UI state. Unread tracking and selection stay on the frontend.
 */
export function useReceived({ configured, pollIntervalSec }: Options) {
  const [emails, setEmails] = useState<ReceivedEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);

  // Latest interval, read inside event handlers without re-subscribing.
  const intervalRef = useRef(pollIntervalSec);
  intervalRef.current = pollIntervalSec;
  const appliedInterval = useRef<number | null>(null);

  // Start/stop the Rust poller alongside the configured lifecycle.
  useEffect(() => {
    if (!configured) {
      setNextRefreshAt(null);
      return;
    }
    let cancelled = false;
    let unlistenData: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    setLoading(true);
    void ensureNotificationPermission();

    (async () => {
      unlistenData = await listen<InboxData>("inbox-data", (event) => {
        const { emails: data, newIds } = event.payload;
        setEmails(data ?? []);
        if (newIds?.length) {
          setUnreadIds((prev) => {
            const next = new Set(prev);
            newIds.forEach((id) => next.add(id));
            return next;
          });
        }
        setError(null);
        setLoading(false);
        setNextRefreshAt(Date.now() + Math.max(30, intervalRef.current) * 1000);
      });
      unlistenError = await listen<string>("inbox-error", (event) => {
        setError(event.payload);
        setLoading(false);
      });

      if (cancelled) {
        unlistenData?.();
        unlistenError?.();
        return;
      }
      appliedInterval.current = intervalRef.current;
      await api.startPoller(intervalRef.current);
    })();

    return () => {
      cancelled = true;
      unlistenData?.();
      unlistenError?.();
      void api.stopPoller();
    };
    // Interval changes are applied via the effect below, not a full restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  // Apply interval changes to the running poller without restarting it.
  useEffect(() => {
    if (!configured || appliedInterval.current === null) return;
    if (appliedInterval.current === pollIntervalSec) return;
    appliedInterval.current = pollIntervalSec;
    void api.setPollInterval(pollIntervalSec);
    setNextRefreshAt(Date.now() + Math.max(30, pollIntervalSec) * 1000);
  }, [configured, pollIntervalSec]);

  const refreshNow = useCallback(() => {
    setLoading(true);
    void api.pollNow();
  }, []);

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
    nextRefreshAt,
    refresh: refreshNow,
    refreshNow,
    markRead,
    markAllRead,
  };
}
