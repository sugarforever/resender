import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { api } from "@/lib/api";
import {
  getDefaultFrom,
  getPollInterval,
  setPollInterval,
  type Theme,
} from "@/lib/prefs";
import { useTheme } from "@/hooks/useTheme";
import { useReceived } from "@/hooks/useReceived";
import { useSent } from "@/hooks/useSent";
import { Sidebar, type View } from "@/components/Sidebar";
import { Onboarding } from "@/components/Onboarding";
import { MailboxView } from "@/components/MailboxView";
import { ComposeView } from "@/components/ComposeView";
import { SettingsView } from "@/components/SettingsView";
import { useConversations } from "@/hooks/useConversations";
import type { ThreadMessage } from "@/lib/threads";

function App() {
  const themeControls = useTheme();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connectionVersion, setConnectionVersion] = useState(0);
  useEffect(() => {
    api
      .hasApiKey()
      .then(setConfigured)
      .catch(() => setConfigured(false));
  }, []);
  if (configured === null)
    return (
      <div className="flex h-full items-center justify-center">Loading…</div>
    );
  const connected = () => {
    setConfigured(true);
    setConnectionVersion((version) => version + 1);
  };
  return (
    <>
      {configured ? (
        <ConnectedApp
          key={connectionVersion}
          themeControls={themeControls}
          onDisconnected={() => setConfigured(false)}
          onKeySaved={connected}
        />
      ) : (
        <Onboarding onConfigured={connected} />
      )}
      <Toaster theme={themeControls.theme} richColors closeButton />
    </>
  );
}

function ConnectedApp({
  onDisconnected,
  onKeySaved,
  themeControls,
}: {
  onDisconnected: () => void;
  onKeySaved: () => void;
  themeControls: ReturnType<typeof useTheme>;
}) {
  const { theme, setTheme, toggle } = themeControls;
  const [view, setView] = useState<View>("inbox");
  const [pollSec, setPollSec] = useState(() => getPollInterval());
  const [defaultFrom, setDefaultFrom] = useState(getDefaultFrom);
  const received = useReceived({
    configured: true,
    pollIntervalSec: pollSec,
  });
  const sent = useSent(true);

  const threads = useConversations(received.emails, sent.emails);
  const refreshSent = sent.refresh;
  useEffect(() => {
    void refreshSent();
  }, [refreshSent]);
  const handleSent = (mail: ThreadMessage) => {
    threads.addSent(mail);
    void sent.refresh();
  };

  const handlePollChange = useCallback((sec: number) => {
    setPollInterval(sec);
    setPollSec(sec);
  }, []);

  const handleThemeChange = useCallback((t: Theme) => setTheme(t), [setTheme]);

  return (
    <>
      <div className="bg-background flex h-full">
        <Sidebar
          view={view}
          onChange={setView}
          unreadCount={received.unreadCount}
          theme={theme}
          onToggleTheme={toggle}
          defaultFrom={defaultFrom}
        />

        <main className="min-w-0 flex-1">
          {view === "inbox" ? (
            <MailboxView
              key="inbox"
              kind="inbox"
              conversations={threads.conversations}
              indexing={threads.indexing}
              incomplete={threads.incomplete}
              onRetryIndex={threads.retry}
              onSent={handleSent}
              loading={received.loading}
              error={received.error}
              onRefresh={received.refreshNow}
              fetchFull={threads.fetchFull}
              unreadIds={received.unreadIds}
              onOpen={received.markRead}
              nextRefreshAt={received.nextRefreshAt}
              pollIntervalSec={pollSec}
            />
          ) : view === "sent" ? (
            <MailboxView
              key="sent"
              kind="sent"
              conversations={threads.conversations}
              indexing={threads.indexing}
              incomplete={threads.incomplete}
              onRetryIndex={threads.retry}
              onSent={handleSent}
              loading={sent.loading}
              error={sent.error}
              onRefresh={() => void sent.refresh()}
              fetchFull={threads.fetchFull}
            />
          ) : view === "compose" ? (
            <ComposeView
              draft={null}
              onSent={(mail) => {
                handleSent(mail);
                setView("sent");
              }}
            />
          ) : (
            <SettingsView
              onFromChange={setDefaultFrom}
              pollIntervalSec={pollSec}
              onPollChange={handlePollChange}
              theme={theme}
              onThemeChange={handleThemeChange}
              onDisconnected={onDisconnected}
              onKeySaved={onKeySaved}
            />
          )}
        </main>
      </div>
    </>
  );
}

export default App;
