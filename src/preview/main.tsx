/** Development-only visual review. Not imported by the application entry point. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { Sidebar, type View } from "@/components/Sidebar";
import { MailboxView } from "@/components/MailboxView";
import { ComposeView } from "@/components/ComposeView";
import { SettingsView } from "@/components/SettingsView";
import { Onboarding } from "@/components/Onboarding";
import { api } from "@/lib/api";
import { buildConversations, type ThreadMessage } from "@/lib/threads";
import type { Theme } from "@/lib/prefs";
import "@/index.css";

const sender = "Alex Morgan <alex@northstar.example>";
const maya = "Maya Chen <maya@studio.example>";
const bodies = [
  "Here is the checklist for Thursday’s launch.",
  "Thanks, Maya. I’ll take the copy review and send notes by Wednesday.",
  "Copy review notes are in. Two headlines still need a decision.",
  "Staging checks are running against the release branch now.",
  "I’ll approve the final copy as soon as staging is green.",
  "The staging checks passed. Can you confirm the final copy?",
  "The final copy is approved. We are ready for Thursday.\n\nAlex",
];
const messages: ThreadMessage[] = bodies.map(
  (text, i): ThreadMessage => ({
    id: `launch-${i}`,
    message_id: `<launch-${i}@northstar.example>`,
    direction: i % 2 === 0 && i !== 6 ? "received" : "sent",
    from: i === 6 || i % 2 ? sender : maya,
    to: [i === 6 || i % 2 ? maya : sender],
    subject: "Launch checklist",
    text,
    headers: i ? { "In-Reply-To": `<launch-${i - 1}@northstar.example>` } : {},
    created_at: `2026-11-${String(i + 3).padStart(2, "0")}T09:14:00Z`,
    last_event: "delivered",
  }),
);
messages.push({
  id: "invoice",
  direction: "received",
  from: maya,
  to: [sender],
  subject: "Invoice for October",
  text: "Attached is the invoice for October’s design work.\n\nLet me know if anything needs to change.\n\nMaya",
  created_at: "2026-11-09T07:55:00Z",
});
messages.push({
  id: "question",
  direction: "received",
  from: "Jordan Lee <jordan@partner.example>",
  to: [sender],
  subject: "Quick question about the integration",
  text: "Can we review the integration together on Thursday?",
  created_at: "2026-11-09T08:41:00Z",
});

function Preview() {
  const [width, setWidth] = useState(0);
  const [view, setView] = useState<View>("inbox");
  const [mailbox, setMailbox] = useState<"inbox" | "sent">("inbox");
  const navigate = (next: View) => {
    if (next === "inbox" || next === "sent") setMailbox(next);
    setView(next);
  };
  const [onboarding, setOnboarding] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [state, setState] = useState("loaded");
  const [from, setFrom] = useState(sender);
  const [mail, setMail] = useState(messages);
  const [poll, setPoll] = useState(60);
  const changeTheme = (next: Theme) => {
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };
  return (
    <>
      <div className="flex h-9 items-center gap-3 border-b bg-muted px-4 text-[11px] text-muted-foreground">
        <span>Synthetic review · no real mail is sent</span>
        <button
          onClick={() => setOnboarding(!onboarding)}
          className="underline"
        >
          {onboarding ? "App" : "Onboarding"}
        </button>
        <select
          aria-label="Preview width"
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
          className="ml-auto bg-background"
        >
          <option value={0}>Window width</option>
          <option value={1440}>1440 px</option>
          <option value={1100}>1100 px</option>
          <option value={800}>800 px</option>
        </select>
        <select
          aria-label="Preview state"
          value={state}
          onChange={(event) => setState(event.target.value)}
          className="ml-auto bg-background"
        >
          <option value="loaded">Loaded</option>
          <option value="loading">Loading</option>
          <option value="empty">Empty</option>
          <option value="error">Refresh error</option>
          <option value="partial">Partial history</option>
        </select>
      </div>
      <div
        className="app-shell flex bg-background"
        style={{
          height: "calc(100% - 36px)",
          width: width || "100%",
          maxWidth: "100%",
          marginInline: "auto",
        }}
      >
        {onboarding ? (
          <div className="flex-1">
            <Onboarding onConfigured={() => setOnboarding(false)} />
          </div>
        ) : (
          <>
            <Sidebar
              view={view}
              onChange={navigate}
              unreadCount={2}
              theme={theme}
              onToggleTheme={() =>
                changeTheme(theme === "light" ? "dark" : "light")
              }
              defaultFrom={from}
            />
            <main className="min-w-0 flex-1">
              {view === "settings" ? (
                <SettingsView
                  onFromChange={setFrom}
                  pollIntervalSec={poll}
                  onPollChange={setPoll}
                  theme={theme}
                  onThemeChange={changeTheme}
                  onDisconnected={() => setOnboarding(true)}
                  onKeySaved={() => {}}
                />
              ) : (
                <MailboxView
                  key={mailbox}
                  kind={mailbox}
                  composer={
                    view === "compose" ? (
                      <ComposeView
                        onSent={(message) => {
                          setMail((current) => [...current, message]);
                          navigate("sent");
                        }}
                      />
                    ) : undefined
                  }
                  onCloseComposer={() => setView(mailbox)}
                  conversations={buildConversations(
                    state === "empty" || state === "loading" ? [] : mail,
                  )}
                  indexing={false}
                  incomplete={state === "partial"}
                  onRetryIndex={() => setState("loaded")}
                  onSent={(message) =>
                    setMail((current) => [...current, message])
                  }
                  loading={state === "loading"}
                  error={
                    state === "error"
                      ? "Couldn’t refresh mail. Check your connection and try again."
                      : null
                  }
                  onRefresh={() => setState("loaded")}
                  fetchFull={async (message) => message}
                  unreadIds={new Set(["question", "invoice"])}
                  nextRefreshAt={Date.now() + 45000}
                  pollIntervalSec={poll}
                />
              )}
            </main>
          </>
        )}
      </div>
      <Toaster theme={theme} />
    </>
  );
}

// A separate preview origin prevents synthetic preferences touching the desktop app.
if (import.meta.env.DEV && location.port === "1421") {
  localStorage.setItem("resender.defaultFrom", sender);
  api.listDomains = async () => ({
    object: "list",
    has_more: false,
    data: [
      {
        id: "domain",
        name: "northstar.example",
        status: "verified",
        region: "eu-west-1",
      },
      {
        id: "pending",
        name: "updates.example",
        status: "pending",
        region: "eu-west-1",
      },
    ],
  });
  api.revealApiKey = async () => "re_SYNTHETIC_PREVIEW_ONLY";
  api.saveApiKey = async () => {};
  api.deleteApiKey = async () => {};
  api.sendEmail = async () => ({ id: `synthetic-${Date.now()}` });
  createRoot(document.getElementById("root")!).render(<Preview />);
} else {
  document.getElementById("root")!.textContent =
    "Run the design preview on the separate development port 1421. See docs/design/implementation.md.";
}
