import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { api } from "@/lib/api";
import { getPollInterval, setPollInterval, type Theme } from "@/lib/prefs";
import { useTheme } from "@/hooks/useTheme";
import { useReceived } from "@/hooks/useReceived";
import { useSent } from "@/hooks/useSent";
import { Sidebar, type View } from "@/components/Sidebar";
import { Onboarding } from "@/components/Onboarding";
import { MailboxView } from "@/components/MailboxView";
import { ComposeView, type Draft } from "@/components/ComposeView";
import { SettingsView } from "@/components/SettingsView";
import type { Mail } from "@/lib/types";

function App() {
  const { theme, setTheme, toggle } = useTheme();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [view, setView] = useState<View>("inbox");
  const [pollSec, setPollSec] = useState(() => getPollInterval());
  const [draft, setDraft] = useState<Draft | null>(null);

  const received = useReceived({
    configured: configured === true,
    pollIntervalSec: pollSec,
  });
  const sent = useSent(configured === true);

  // Check for a stored key on startup.
  useEffect(() => {
    api
      .hasApiKey()
      .then(setConfigured)
      .catch(() => setConfigured(false));
  }, []);

  // Lazily (re)load sent mail whenever that tab is opened.
  useEffect(() => {
    if (configured === true && view === "sent") void sent.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, view]);

  const handlePollChange = useCallback((sec: number) => {
    setPollInterval(sec);
    setPollSec(sec);
  }, []);

  const handleThemeChange = useCallback(
    (t: Theme) => setTheme(t),
    [setTheme]
  );

  const startReply = useCallback((email: Mail) => {
    const subject = email.subject ?? "";
    setDraft({
      to: email.from,
      subject: subject.toLowerCase().startsWith("re:")
        ? subject
        : `Re: ${subject}`,
    });
    setView("compose");
  }, []);

  const openCompose = (v: View) => {
    if (v === "compose") setDraft(null); // fresh message from the nav
    setView(v);
  };

  if (configured === null) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  return (
    <>
      <div className="bg-background flex h-full">
        {configured && (
          <Sidebar
            view={view}
            onChange={openCompose}
            unreadCount={received.unreadCount}
            theme={theme}
            onToggleTheme={toggle}
          />
        )}

        <main className="min-w-0 flex-1">
          {!configured ? (
            <Onboarding onConfigured={() => setConfigured(true)} />
          ) : view === "inbox" ? (
            <MailboxView
              kind="inbox"
              emails={received.emails}
              loading={received.loading}
              error={received.error}
              onRefresh={() => void received.refresh()}
              fetchFull={(id) => api.getReceived(id)}
              unreadIds={received.unreadIds}
              onOpen={received.markRead}
              onReply={startReply}
            />
          ) : view === "sent" ? (
            <MailboxView
              kind="sent"
              emails={sent.emails}
              loading={sent.loading}
              error={sent.error}
              onRefresh={() => void sent.refresh()}
              fetchFull={(id) => api.getSent(id)}
            />
          ) : view === "compose" ? (
            <ComposeView
              draft={draft}
              onSent={() => {
                void sent.refresh();
                setView("sent");
              }}
            />
          ) : (
            <SettingsView
              pollIntervalSec={pollSec}
              onPollChange={handlePollChange}
              theme={theme}
              onThemeChange={handleThemeChange}
              onDisconnected={() => {
                setConfigured(false);
                setView("inbox");
              }}
              onKeySaved={() => setConfigured(true)}
            />
          )}
        </main>
      </div>
      <Toaster theme={theme} richColors closeButton />
    </>
  );
}

export default App;
