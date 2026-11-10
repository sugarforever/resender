import { useCallback, useEffect, useMemo, useState } from "react";
import { MailLoader } from "@/lib/mail-loader";
import { buildConversations, type ThreadMessage } from "@/lib/threads";
import { loadReplyLinks } from "@/lib/reply-links";
import type { ReceivedEmail, SentEmail } from "@/lib/types";

export function useConversations(received: ReceivedEmail[], sent: SentEmail[]) {
  const [, update] = useState(0);
  // This hook lives in a workspace keyed by connection, so caches cannot cross keys.
  const [loader, setLoader] = useState<MailLoader | null>(null);
  const [localSent, setLocalSent] = useState<ThreadMessage[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [revision, setRevision] = useState(0);
  const summaries = useMemo<ThreadMessage[]>(() => {
    const serverIds = new Set(sent.map((mail) => mail.id));
    const optimistic = new Map(localSent.map((mail) => [mail.id, mail]));
    return [
      ...received.map((mail) => ({ ...mail, direction: "received" as const })),
      ...sent.map((mail) => ({
        ...optimistic.get(mail.id),
        ...mail,
        direction: "sent" as const,
      })),
      ...localSent.filter((mail) => !serverIds.has(mail.id)),
    ];
  }, [received, sent, localSent]);

  useEffect(() => {
    const next = new MailLoader(() => update((n) => n + 1));
    setLoader(next);
    return () => next.dispose();
  }, []);
  useEffect(() => {
    if (!loader) return;
    let cancelled = false;
    setIndexing(true);
    setIncomplete(false);
    void (async () => {
      for (const mail of summaries) {
        if (cancelled) return;
        try {
          await loader.get(mail, false);
        } catch {
          if (!cancelled) setIncomplete(true);
        }
      }
      if (!cancelled) setIndexing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loader, summaries, revision]);

  const links = loadReplyLinks();
  const messages = summaries.map((mail) => {
    const full = loader?.peek(mail);
    return {
      ...mail,
      ...full,
      headers: {
        ...mail.headers,
        ...full?.headers,
        ...(mail.direction === "sent" ? links[mail.id] : {}),
      },
    };
  });
  const addSent = useCallback(
    (mail: ThreadMessage) => setLocalSent((current) => [...current, mail]),
    [],
  );
  const fetchFull = useCallback(
    (mail: ThreadMessage) =>
      loader
        ? loader.get(mail)
        : Promise.reject(new Error("Loading connection…")),
    [loader],
  );
  return {
    conversations: buildConversations(messages),
    addSent,
    fetchFull,
    indexing,
    incomplete,
    retry: () => setRevision((n) => n + 1),
  };
}
