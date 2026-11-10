import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMessage } from "@/lib/api";
import type { SentEmail } from "@/lib/types";
import { isDeliveryPending } from "@/lib/delivery-status";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useSent(configured: boolean) {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const refreshAgain = useRef(false);
  const active = useRef(false);

  const refresh = useCallback(
    async (background = false) => {
      if (!configured || !active.current) return;
      if (inFlight.current) {
        refreshAgain.current = true;
        return;
      }
      inFlight.current = true;
      if (!background) setLoading(true);
      try {
        const res = await api.listSent(50);
        if (!active.current) return;
        setEmails(res.data ?? []);
        setError(null);
      } catch (e) {
        if (active.current) setError(errMessage(e));
      } finally {
        inFlight.current = false;
        setLoading(false);
        if (active.current && refreshAgain.current) {
          refreshAgain.current = false;
          void refresh(true);
        }
      }
    },
    [configured],
  );

  useEffect(() => {
    active.current = configured;
    if (!configured) return;
    void refresh();
    const sync = () => void refresh(true);
    const visible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", visible);
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        unlisten = await getCurrentWindow().onFocusChanged(({ payload }) => {
          if (payload) sync();
        });
        if (cancelled) unlisten();
      } catch {
        /* Browser previews still use DOM focus/visibility events. */
      }
    })();
    return () => {
      active.current = false;
      cancelled = true;
      refreshAgain.current = false;
      unlisten?.();
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [configured, refresh]);

  const pending = emails.some((mail) => isDeliveryPending(mail.last_event));
  useEffect(() => {
    if (!configured) return;
    const timer = setInterval(
      () => void refresh(true),
      pending ? 10_000 : 60_000,
    );
    return () => clearInterval(timer);
  }, [configured, pending, refresh]);

  return { emails, loading, error, refresh };
}
