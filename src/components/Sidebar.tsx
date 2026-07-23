import { Inbox, Send, PenSquare, Settings, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/prefs";

export type View = "inbox" | "sent" | "compose" | "settings";

interface Props {
  view: View;
  onChange: (v: View) => void;
  unreadCount: number;
  theme: Theme;
  onToggleTheme: () => void;
}

const NAV: { id: View; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
];

export function Sidebar({
  view,
  onChange,
  unreadCount,
  theme,
  onToggleTheme,
}: Props) {
  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex w-60 shrink-0 flex-col border-r">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <img
          src="/logo.png"
          alt="Resender"
          className="size-7 rounded-lg shadow-sm"
        />
        <span className="text-foreground text-[15px] font-semibold tracking-tight">
          Resender
        </span>
      </div>

      <div className="px-3 pt-1 pb-2">
        <Button
          onClick={() => onChange("compose")}
          className="w-full justify-start gap-2 shadow-sm"
        >
          <PenSquare className="size-4" />
          Compose
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map(({ id, label, icon: Icon }) => (
          <NavItem
            key={id}
            active={view === id}
            onClick={() => onChange(id)}
            icon={Icon}
            label={label}
            trailing={
              id === "inbox" && unreadCount > 0 ? (
                <Badge className="bg-brand text-brand-foreground h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px] tabular-nums shadow-none">
                  {unreadCount}
                </Badge>
              ) : undefined
            }
          />
        ))}
      </nav>

      <div className="flex items-center gap-1 px-3 pb-3">
        <NavItem
          active={view === "settings"}
          onClick={() => onChange("settings")}
          icon={Settings}
          label="Settings"
          className="flex-1"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shrink-0"
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

function NavItem({
  active,
  onClick,
  icon: Icon,
  label,
  trailing,
  className,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Inbox;
  label: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors duration-150 cursor-pointer",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        className
      )}
    >
      <span
        className={cn(
          "bg-brand absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <Icon
        className={cn(
          "size-4 transition-colors",
          active ? "text-brand" : "text-current"
        )}
      />
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
}
