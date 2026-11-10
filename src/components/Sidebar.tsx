import { useState } from "react";
import {
  Inbox,
  Send,
  PenSquare,
  Settings,
  Moon,
  Sun,
  Globe,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/prefs";
import { parseAddress } from "@/lib/format";
import { ConnectedDomains } from "@/components/ConnectedDomains";

export type View = "inbox" | "sent" | "compose" | "settings";
interface Props {
  view: View;
  onChange: (v: View) => void;
  unreadCount: number;
  theme: Theme;
  onToggleTheme: () => void;
  defaultFrom: string;
}

export function Sidebar({
  view,
  onChange,
  unreadCount,
  theme,
  onToggleTheme,
  defaultFrom,
}: Props) {
  const [domainsOpen, setDomainsOpen] = useState(false);
  const { email } = parseAddress(defaultFrom);
  return (
    <aside className="app-sidebar bg-sidebar text-sidebar-foreground flex shrink-0 flex-col border-r">
      <button
        className="sidebar-brand flex w-full items-center gap-2.5 px-4 py-5 text-left"
        onClick={() => onChange("settings")}
        aria-label="Sender identity — open Settings"
        title={defaultFrom || "Set your default sender in Settings"}
      >
        <img src="/logo.png" alt="" className="size-7 shrink-0 rounded-md" />
        <span className="sidebar-identity-copy min-w-0 flex-1">
          <span className="text-foreground block text-sm font-semibold">
            Resender
          </span>
          <span className="text-muted-foreground block truncate text-[11px]">
            {email || "Set default sender"}
          </span>
        </span>
        <ChevronDown className="sidebar-label size-3 text-muted-foreground" />
      </button>
      <Button
        variant="outline"
        onClick={() => onChange("compose")}
        aria-label="Compose"
        title="Compose"
        className="sidebar-compose mx-3 mb-4 justify-start gap-2.5 border-input text-[13px] shadow-none"
      >
        <PenSquare className="size-4 text-brand" />
        <span className="sidebar-label">Compose</span>
      </Button>
      <nav
        aria-label="Mailboxes"
        className="sidebar-nav flex flex-col gap-0.5 px-3"
      >
        {(
          [
            { id: "inbox", label: "Inbox", icon: Inbox },
            { id: "sent", label: "Sent", icon: Send },
            { id: "settings", label: "Settings", icon: Settings },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-label={label}
            title={label}
            aria-current={view === id ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center gap-2.5 rounded-md px-3 text-[13px] transition-colors",
              view === id
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                : "hover:bg-muted",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="sidebar-label flex-1 text-left">{label}</span>
            {id === "inbox" && unreadCount > 0 && (
              <span className="sidebar-unread text-xs font-semibold tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-domains relative mt-6" data-open={domainsOpen}>
        <button
          className="domain-trigger hidden size-9 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Connected domains"
          title="Connected domains"
          aria-expanded={domainsOpen}
          onClick={() => setDomainsOpen(!domainsOpen)}
        >
          <Globe className="size-4" />
        </button>
        <div className="sidebar-domain-content">
          <ConnectedDomains />
        </div>
      </div>
      <div className="sidebar-footer mt-auto flex items-center justify-between gap-2 border-t px-4 py-3">
        <span className="sidebar-caption flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-ok" />
          Connected
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          className="size-8 text-muted-foreground"
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
