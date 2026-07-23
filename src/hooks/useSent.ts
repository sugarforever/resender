import { useCallback, useState } from "react";
import { api, errMessage } from "@/lib/api";
import type { SentEmail } from "@/lib/types";

export function useSent(configured: boolean) {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    try {
      const res = await api.listSent(50);
      setEmails(res.data ?? []);
      setError(null);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  return { emails, loading, error, refresh };
}
