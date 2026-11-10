import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMessage } from "@/lib/api";
import type { SentEmail } from "@/lib/types";
import { isDeliveryPending } from "@/lib/delivery-status";

export function useSent(configured: boolean) {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (background = false) => {
      if (!configured || inFlight.current) return;
      inFlight.current = true;
      if (!background) setLoading(true);
      try {
        const res = await api.listSent(50);
        setEmails(res.data ?? []);
        setError(null);
      } catch (e) {
        setError(errMessage(e));
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [configured],
  );

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
