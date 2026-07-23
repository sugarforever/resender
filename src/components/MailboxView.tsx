import { useCallback, useEffect, useRef, useState } from "react";
import {
  Inbox as InboxIcon,
  Send as SendIcon,
  RefreshCw,
  Paperclip,
  AlertCircle,
  Reply,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { errMessage } from "@/lib/api";
import {
  avatarStyle,
  displayName,
  fullDate,
  initials,
  joinAddresses,
  parseAddress,
  shortDate,
} from "@/lib/format";
import type { Mail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCountdown } from "@/components/RefreshCountdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const LIST_WIDTH_KEY = "resender.listWidth";
const MIN_LIST_WIDTH = 260;
const MIN_READING_WIDTH = 380;

interface Props {
  kind: "inbox" | "sent";
  emails: Mail[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  fetchFull: (id: string) => Promise<Mail>;
  unreadIds?: Set<string>;
  onOpen?: (id: string) => void;
  onReply?: (email: Mail) => void;
  /** When provided (inbox), the refresh button shows a poll countdown. */
  nextRefreshAt?: number | null;
  pollIntervalSec?: number;
}

export function MailboxView({
  kind,
  emails,
  loading,
  error,
  onRefresh,
  fetchFull,
  unreadIds,
  onOpen,
  onReply,
  nextRefreshAt,
  pollIntervalSec,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [full, setFull] = useState<Mail | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [fullError, setFullError] = useState<string | null>(null);

  // Draggable list/detail splitter (self-contained, persisted).
  const groupRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [listWidth, setListWidth] = useState(() => {
    const v = Number(localStorage.getItem(LIST_WIDTH_KEY));
    return Number.isFinite(v) && v > 0 ? v : 340;
  });

  useEffect(() => {
    localStorage.setItem(LIST_WIDTH_KEY, String(Math.round(listWidth)));
  }, [listWidth]);

  // Pointer capture keeps move events flowing to the handle even when the
  // cursor passes over the reading-pane iframe (which would otherwise eat them).
  const onHandleDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onHandleMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const rect = groupRef.current?.getBoundingClientRect();
    if (!rect) return;
    const max = Math.max(MIN_LIST_WIDTH, rect.width - MIN_READING_WIDTH);
    const next = Math.min(max, Math.max(MIN_LIST_WIDTH, e.clientX - rect.left));
    setListWidth(next);
  }, []);

  const onHandleUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  // Keep a valid selection as the list changes.
  useEffect(() => {
    if (emails.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !emails.some((e) => e.id === selectedId)) {
      setSelectedId(emails[0].id);
    }
  }, [emails, selectedId]);

  // Load the full body whenever the selection changes.
  useEffect(() => {
    if (!selectedId) {
      setFull(null);
      return;
    }
    let cancelled = false;
    setLoadingFull(true);
    setFullError(null);
    setFull(null);
    fetchFull(selectedId)
      .then((mail) => {
        if (!cancelled) setFull(mail);
      })
      .catch((e) => {
        if (!cancelled) setFullError(errMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingFull(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, fetchFull]);

  const selectRow = (id: string) => {
    setSelectedId(id);
    onOpen?.(id);
  };

  return (
    <div ref={groupRef} className="flex h-full min-h-0">
      {/* List column */}
      <div
        className="bg-background flex h-full min-h-0 shrink-0 flex-col"
        style={{ width: listWidth }}
      >
        <header className="flex h-14 items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-[15px] font-semibold capitalize">{kind}</h1>
            {emails.length > 0 && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {emails.length}
              </span>
            )}
          </div>
          {typeof pollIntervalSec === "number" ? (
            <RefreshCountdown
              nextRefreshAt={nextRefreshAt ?? null}
              intervalMs={Math.max(30, pollIntervalSec) * 1000}
              onRefresh={onRefresh}
              loading={loading}
            />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh"
              className="text-muted-foreground hover:text-foreground size-8"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          )}
        </header>

        {error && (
          <div className="text-destructive bg-destructive/5 mx-3 mb-1 flex items-start gap-2 rounded-md px-3 py-2 text-xs">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Native scroll container, NOT Radix ScrollArea: the latter wraps
            children in a `display: table` element (min-width:100%) whose
            intrinsic width defeats `truncate`, pushing the timestamp offscreen.
            See radix-ui/primitives#926. */}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {emails.length === 0 && !loading && !error ? (
            <EmptyList kind={kind} />
          ) : (
            <ul className="flex flex-col gap-0.5 p-2">
              {emails.map((mail) => {
                const isUnread = unreadIds?.has(mail.id) ?? false;
                const person = kind === "inbox" ? mail.from : mail.to?.[0] ?? "";
                const selected = selectedId === mail.id;
                const label =
                  kind === "inbox"
                    ? displayName(person)
                    : joinAddresses(mail.to) || "(no recipient)";
                return (
                  <li key={mail.id}>
                    <button
                      onClick={() => selectRow(mail.id)}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-lg py-2.5 pr-3 pl-2.5 text-left transition-colors duration-150 cursor-pointer",
                        selected
                          ? "bg-accent"
                          : "hover:bg-accent/55"
                      )}
                    >
                      <span
                        className={cn(
                          "bg-brand absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity duration-150",
                          selected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                        style={avatarStyle(person)}
                      >
                        {initials(person)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-sm",
                              isUnread
                                ? "text-foreground font-semibold"
                                : "font-medium"
                            )}
                          >
                            {label}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                            {shortDate(mail.created_at)}
                          </span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          {isUnread && (
                            <span className="bg-brand size-1.5 shrink-0 rounded-full" />
                          )}
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-[13px]",
                              isUnread
                                ? "text-foreground/90"
                                : "text-muted-foreground"
                            )}
                          >
                            {mail.subject || "(no subject)"}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Drag handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        style={{ touchAction: "none" }}
        className="group bg-border hover:bg-brand/50 relative w-px shrink-0 cursor-col-resize transition-colors"
      >
        {/* Widened, invisible hit area for easy grabbing. */}
        <span className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
        <span className="bg-border group-hover:bg-brand text-muted-foreground group-hover:text-brand-foreground absolute top-1/2 left-1/2 z-10 flex h-6 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm border opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical className="size-2.5" />
        </span>
      </div>

      {/* Reading pane */}
      <div className="bg-card flex h-full min-h-0 min-w-0 flex-1 flex-col">
        {!selectedId ? (
          <EmptyReading kind={kind} />
        ) : (
          <ReadingPane
            kind={kind}
            summary={emails.find((e) => e.id === selectedId) ?? null}
            full={full}
            loading={loadingFull}
            error={fullError}
            onReply={onReply}
          />
        )}
      </div>
    </div>
  );
}

function ReadingPane({
  kind,
  summary,
  full,
  loading,
  error,
  onReply,
}: {
  kind: "inbox" | "sent";
  summary: Mail | null;
  full: Mail | null;
  loading: boolean;
  error: string | null;
  onReply?: (email: Mail) => void;
}) {
  const mail = full ?? summary;
  if (!mail) return null;

  const person = kind === "inbox" ? mail.from : mail.to?.[0] ?? "";
  const { email: personEmail } = parseAddress(person);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-4 px-7 pt-6 pb-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl leading-snug font-semibold tracking-tight text-balance">
            {mail.subject || "(no subject)"}
          </h2>
          <div className="mt-3.5 flex items-center gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              style={avatarStyle(person)}
            >
              {initials(person)}
            </div>
            <div className="min-w-0 text-sm">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="font-semibold">{displayName(person)}</span>
                {personEmail && displayName(person) !== personEmail && (
                  <span className="text-muted-foreground truncate">
                    &lt;{personEmail}&gt;
                  </span>
                )}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {kind === "inbox" ? "to me" : `to ${joinAddresses(mail.to)}`}
                {" · "}
                {fullDate(mail.created_at)}
              </div>
            </div>
          </div>
        </div>
        {kind === "inbox" && onReply && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReply(mail)}
            className="shadow-xs"
          >
            <Reply className="size-4" />
            Reply
          </Button>
        )}
      </div>

      {(kind === "sent" && mail.last_event) ||
      (full?.attachments && full.attachments.length > 0) ? (
        <div className="flex flex-wrap items-center gap-2 px-7 pb-3">
          {kind === "sent" && mail.last_event && (
            <Badge variant="secondary" className="capitalize">
              {mail.last_event.replace(/_/g, " ")}
            </Badge>
          )}
          {full?.attachments?.map((a) => (
            <Badge key={a.id} variant="outline" className="gap-1.5 font-normal">
              <Paperclip className="size-3" />
              {a.filename}
            </Badge>
          ))}
        </div>
      ) : null}

      <Separator />

      <div className="min-h-0 flex-1">
        {loading ? (
          <BodySkeleton />
        ) : error ? (
          <div className="text-destructive flex items-start gap-2 p-7 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <MailBody html={full?.html} text={full?.text} />
        )}
      </div>
    </div>
  );
}

function MailBody({ html, text }: { html?: string; text?: string }) {
  if (html && html.trim()) {
    return (
      <iframe
        // Sandboxed with no allow-scripts: remote email HTML cannot run JS.
        sandbox=""
        title="Email content"
        className="h-full w-full bg-white"
        srcDoc={html}
      />
    );
  }
  if (text && text.trim()) {
    return (
      <ScrollArea className="h-full">
        <pre className="text-foreground/90 p-7 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">
          {text}
        </pre>
      </ScrollArea>
    );
  }
  return (
    <div className="text-muted-foreground p-7 text-sm">
      This email has no content to display.
    </div>
  );
}

function BodySkeleton() {
  return (
    <div className="flex flex-col gap-3 p-7">
      {[100, 92, 96, 70, 88, 60].map((w, i) => (
        <div
          key={i}
          className="bg-muted h-3.5 animate-pulse rounded"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}

function EmptyList({ kind }: { kind: "inbox" | "sent" }) {
  const Icon = kind === "inbox" ? InboxIcon : SendIcon;
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div className="bg-muted/60 mb-1 flex size-12 items-center justify-center rounded-full">
        <Icon className="size-5 opacity-60" />
      </div>
      <p className="text-sm">
        {kind === "inbox" ? "No emails received yet." : "No emails sent yet."}
      </p>
    </div>
  );
}

function EmptyReading({ kind }: { kind: "inbox" | "sent" }) {
  const Icon = kind === "inbox" ? InboxIcon : SendIcon;
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
      <div className="bg-muted/50 flex size-14 items-center justify-center rounded-2xl">
        <Icon className="size-6 opacity-50" />
      </div>
      <p className="text-sm">Select an email to read</p>
    </div>
  );
}
