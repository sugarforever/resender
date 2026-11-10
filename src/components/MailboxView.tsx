import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Inbox as InboxIcon,
  Send as SendIcon,
  RefreshCw,
  AlertCircle,
  GripVertical,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { displayName, joinAddresses, shortDate } from "@/lib/format";
import type { Conversation, ThreadMessage } from "@/lib/threads";
import { ConversationView } from "./ConversationView";
import { Button } from "@/components/ui/button";
import { RefreshCountdown } from "@/components/RefreshCountdown";

const LIST_WIDTH_KEY = "resender.listWidth";
const MIN_LIST_WIDTH = 260;
const MIN_READING_WIDTH = 380;

interface Props {
  revealMessageId?: string;
  composer?: ReactNode;
  onCloseComposer?: () => void;
  kind: "inbox" | "sent";
  conversations: Conversation[];
  indexing: boolean;
  incomplete: boolean;
  onRetryIndex: () => void;
  onSent: (mail: ThreadMessage) => void;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  fetchFull: (mail: ThreadMessage) => Promise<ThreadMessage>;
  unreadIds?: Set<string>;
  onOpen?: (id: string) => void;
  /** When provided (inbox), the refresh button shows a poll countdown. */
  nextRefreshAt?: number | null;
  pollIntervalSec?: number;
}

export function MailboxView({
  revealMessageId,
  composer,
  onCloseComposer,
  kind,
  conversations,
  indexing,
  incomplete,
  onRetryIndex,
  onSent,
  loading,
  error,
  onRefresh,
  fetchFull,
  unreadIds,
  onOpen,
  nextRefreshAt,
  pollIntervalSec,
}: Props) {
  const [reading, setReading] = useState(false);
  const [restoreListFocus, setRestoreListFocus] = useState(false);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (restoreListFocus) {
      activeRowRef.current?.focus();
      setRestoreListFocus(false);
    }
  }, [restoreListFocus]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (revealMessageId) {
      setSelectedId(revealMessageId);
      setReading(true);
    }
  }, [revealMessageId]);
  useEffect(() => {
    if (reading && backRef.current?.getClientRects().length)
      backRef.current.focus();
  }, [reading]);
  const direction = kind === "inbox" ? "received" : "sent";
  const threads = conversations.filter((thread) =>
    thread.messages.some((mail) => mail.direction === direction),
  );
  const emails = threads.map(
    (thread) => thread.messages[thread.messages.length - 1],
  );
  const selectedThread = threads.find((thread) =>
    thread.messages.some((mail) => mail.id === selectedId),
  );

  // Draggable list/detail splitter (self-contained, persisted).
  const groupRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [availableWidth, setAvailableWidth] = useState(1000);
  const maxListWidth = Math.min(
    560,
    Math.max(MIN_LIST_WIDTH, availableWidth - MIN_READING_WIDTH),
  );
  useEffect(() => {
    if (!groupRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0)
        setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(groupRef.current);
    return () => observer.disconnect();
  }, []);
  const [listWidth, setListWidth] = useState(() => {
    const v = Number(localStorage.getItem(LIST_WIDTH_KEY));
    return Number.isFinite(v) && v > 0 ? Math.max(260, Math.min(560, v)) : 360;
  });

  useEffect(() => {
    setListWidth((current) => Math.min(current, maxListWidth));
  }, [maxListWidth]);

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
    const max = Math.min(
      560,
      Math.max(MIN_LIST_WIDTH, rect.width - MIN_READING_WIDTH),
    );
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

  // Retain the selected message even when its thread receives a new reply.
  useEffect(() => {
    if (!selectedThread) setSelectedId(emails[0]?.id ?? null);
  }, [selectedThread, emails]);

  const selectRow = (id: string) => {
    setReading(true);
    onCloseComposer?.();
    const thread = threads.find((item) =>
      item.messages.some((mail) => mail.id === id),
    );
    if (thread !== selectedThread) setSelectedId(id);
    thread?.messages
      .filter((mail) => mail.direction === "received")
      .forEach((mail) => onOpen?.(mail.id));
  };

  return (
    <div
      ref={groupRef}
      className="mailbox flex h-full min-h-0"
      data-reading={reading || !!composer}
    >
      {/* List column */}
      <div
        className="mail-list bg-background flex h-full min-h-0 shrink-0 flex-col"
        style={{ width: listWidth }}
      >
        <header className="pane-header flex h-14 shrink-0 items-center justify-between border-b px-4">
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
          <div
            role="alert"
            className="text-destructive bg-destructive/5 mx-3 mb-1 flex items-start gap-2 rounded-md px-3 py-2 text-xs"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Native scroll container, NOT Radix ScrollArea: the latter wraps
            children in a `display: table` element (min-width:100%) whose
            intrinsic width defeats `truncate`, pushing the timestamp offscreen.
            See radix-ui/primitives#926. */}
        {(indexing || incomplete) && (
          <div
            className="text-muted-foreground border-b px-4 py-2 text-xs"
            role="status"
          >
            {indexing ? (
              "Loading conversation history…"
            ) : (
              <>
                Some history could not be loaded.{" "}
                <button
                  className="underline cursor-pointer"
                  onClick={onRetryIndex}
                >
                  Retry
                </button>
              </>
            )}
          </div>
        )}
        <div
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          aria-busy={loading}
        >
          {loading && emails.length === 0 && (
            <div
              role="status"
              aria-label="Loading conversations"
              className="space-y-5 p-4"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="motion-safe:animate-pulse space-y-2">
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                </div>
              ))}
            </div>
          )}
          {emails.length === 0 && !loading && !error ? (
            <EmptyList kind={kind} />
          ) : (
            <ul
              className="flex flex-col gap-0.5 p-1.5"
              onKeyDown={(event) => {
                if (
                  !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
                )
                  return;
                const rows = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "li > button",
                  ),
                );
                const current = rows.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? rows.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            rows.length - 1,
                            current + (event.key === "ArrowDown" ? 1 : -1),
                          ),
                        );
                event.preventDefault();
                rows[next]?.focus();
              }}
            >
              {emails.map((mail) => {
                const thread = threads.find((item) =>
                  item.messages.some((message) => message.id === mail.id),
                )!;
                const isUnread = thread.messages.some((message) =>
                  unreadIds?.has(message.id),
                );
                const participants = thread.messages.filter(
                  (message) => message.direction === direction,
                );
                const participant = participants[participants.length - 1];
                const person =
                  kind === "inbox"
                    ? participant.from
                    : (participant.to?.[0] ?? "");
                const selected = thread === selectedThread;
                const label =
                  kind === "inbox"
                    ? displayName(person)
                    : joinAddresses(participant.to) || "(no recipient)";
                return (
                  <li key={mail.id}>
                    <button
                      aria-current={selected ? "true" : undefined}
                      onClick={(event) => {
                        activeRowRef.current = event.currentTarget;
                        selectRow(mail.id);
                      }}
                      className={cn(
                        "mail-row group relative flex w-full items-center gap-2 rounded-md px-3 py-3 text-left transition-colors duration-150 cursor-pointer",
                        selected ? "bg-selected" : "hover:bg-accent/55",
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-sm",
                              isUnread
                                ? "text-foreground font-semibold"
                                : "font-medium",
                            )}
                          >
                            {label}
                            {thread.messages.length > 1 && (
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({thread.messages.length})
                              </span>
                            )}
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
                                : "text-muted-foreground",
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
        <footer className="border-t px-4 py-2.5 text-[11px] text-muted-foreground">
          Latest 50 {kind === "inbox" ? "received" : "sent"} messages
        </footer>
      </div>

      {/* Drag handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize conversation list"
        aria-valuemin={260}
        aria-valuemax={maxListWidth}
        aria-valuenow={Math.round(listWidth)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const width = groupRef.current?.getBoundingClientRect().width || 1000;
          const max = Math.min(560, Math.max(260, width - MIN_READING_WIDTH));
          setListWidth((current) =>
            event.key === "Home"
              ? 260
              : event.key === "End"
                ? max
                : Math.max(
                    260,
                    Math.min(
                      max,
                      current + (event.key === "ArrowRight" ? 16 : -16),
                    ),
                  ),
          );
        }}
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        style={{ touchAction: "none" }}
        className="mail-divider group bg-border hover:bg-brand/50 relative w-px shrink-0 cursor-col-resize transition-colors"
      >
        {/* Widened, invisible hit area for easy grabbing. */}
        <span className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
        <span className="bg-border group-hover:bg-brand text-muted-foreground group-hover:text-brand-foreground absolute top-1/2 left-1/2 z-10 flex h-6 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm border opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical className="size-2.5" />
        </span>
      </div>

      {/* Reading pane */}
      <div className="mail-reader bg-card flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <button
          ref={backRef}
          className="reader-back items-center gap-2 border-b px-4 py-2 text-sm text-muted-foreground"
          aria-label="Back to conversation list"
          onClick={() => {
            setReading(false);
            onCloseComposer?.();
            setRestoreListFocus(true);
          }}
        >
          <ArrowLeft className="size-4" />
          {kind === "inbox" ? "Inbox" : "Sent"}
        </button>
        {composer ? (
          composer
        ) : !selectedThread ? (
          <EmptyReading kind={kind} />
        ) : (
          <ConversationView
            key={selectedId}
            conversation={selectedThread}
            fetchFull={fetchFull}
            onSent={onSent}
          />
        )}
      </div>
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
