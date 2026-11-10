import type { Conversation, ThreadMessage } from "@/lib/threads";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Reply, Paperclip } from "lucide-react";
import { ReplyEditor } from "./ReplyEditor";
import { DeliveryStatus } from "./DeliveryStatus";
import { EmailBody } from "./EmailBody";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  displayName,
  fullDate,
  initials,
  joinAddresses,
  shortDate,
} from "@/lib/format";
import { messageId } from "@/lib/threads";
import { errMessage } from "@/lib/api";

export interface ConversationProps {
  conversation: Conversation;
  fetchFull: (mail: ThreadMessage) => Promise<ThreadMessage>;
  onSent: (mail: ThreadMessage) => void;
}

export function ConversationView({
  conversation,
  fetchFull,
  onSent,
}: ConversationProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [replyTarget, setReplyTarget] = useState<ThreadMessage | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (replyTarget)
      composerRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
  }, [replyTarget]);
  const last = conversation.messages[conversation.messages.length - 1];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-baseline gap-3 border-b px-6 py-4">
        <h2 className="text-xl font-semibold">
          {conversation.messages[0].subject || "(no subject)"}
        </h2>
        <p className="text-muted-foreground text-xs">
          {conversation.messages.length}{" "}
          {conversation.messages.length === 1 ? "message" : "messages"}
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-1">
        <div className="divide-border/60 divide-y">
          {conversation.messages.map((mail) => {
            const key = `${mail.direction}:${mail.id}`;
            return (
              <MessageCard
                key={key}
                mail={mail}
                expanded={expanded[key] ?? (mail === last && !replyTarget)}
                fetchFull={fetchFull}
                onToggle={() =>
                  setExpanded((current) => ({
                    ...current,
                    [key]: !(current[key] ?? (mail === last && !replyTarget)),
                  }))
                }
                onReply={(mail) => {
                  setExpanded(
                    Object.fromEntries(
                      conversation.messages.map((message) => [
                        `${message.direction}:${message.id}`,
                        false,
                      ]),
                    ),
                  );
                  setReplyTarget(mail);
                }}
                replyDisabled={!!replyTarget}
              />
            );
          })}
          {replyTarget && (
            <div
              ref={composerRef}
              className="my-4 overflow-hidden rounded-lg border bg-background"
            >
              {!messageId(replyTarget) && (
                <p className="text-muted-foreground px-6 pt-4 text-xs">
                  This message has no Message-ID. Your recipient may see the
                  reply as a separate conversation.
                </p>
              )}
              <ReplyEditor
                key={`${replyTarget.direction}:${replyTarget.id}`}
                original={replyTarget}
                onCancel={() => {
                  setReplyTarget(null);
                  setExpanded({});
                }}
                onSent={(mail) => {
                  onSent(mail);
                  setReplyTarget(null);
                  setExpanded({});
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageCard({
  mail,
  expanded,
  fetchFull,
  onToggle,
  onReply,
  replyDisabled,
}: {
  mail: ThreadMessage;
  expanded: boolean;
  fetchFull: ConversationProps["fetchFull"];
  onToggle: () => void;
  onReply: (mail: ThreadMessage) => void;
  replyDisabled: boolean;
}) {
  const [full, setFull] = useState<ThreadMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setError(null);
    fetchFull(mail)
      .then((result) => {
        if (!cancelled) setFull(result);
      })
      .catch((error) => {
        if (!cancelled) setError(errMessage(error));
      });
    return () => {
      cancelled = true;
    };
    // Header/body snapshots are cached by message identity, not object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mail.id, mail.direction, expanded, fetchFull, revision]);
  const display = {
    ...mail,
    ...full,
    last_event: mail.last_event ?? full?.last_event,
    headers: { ...mail.headers, ...full?.headers },
  };
  return (
    <article>
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} message from ${display.from}`}
          className="hover:bg-accent/30 focus-visible:outline-ring flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] cursor-pointer"
        >
          <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
            {initials(display.from)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {displayName(display.from)}
            </span>
            {expanded && (
              <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                To {joinAddresses(display.to)}
              </span>
            )}
          </span>
          <time
            dateTime={display.created_at}
            title={fullDate(display.created_at)}
            className="text-muted-foreground shrink-0 text-[11px] tabular-nums"
          >
            {shortDate(display.created_at)}
          </time>
          {expanded ? (
            <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
          )}
        </button>
        {mail.direction === "sent" && (
          <DeliveryStatus event={display.last_event} />
        )}
        {mail.direction === "received" && (
          <span aria-hidden="true" className="mr-2 size-6 shrink-0" />
        )}
      </div>
      {expanded && (
        <>
          {error ? (
            <div className="p-4 text-sm">
              <p role="alert" className="text-destructive">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevision((n) => n + 1)}
              >
                Retry message
              </Button>
            </div>
          ) : !full ? (
            <p className="text-muted-foreground p-4 text-sm" role="status">
              Loading message…
            </p>
          ) : (
            <>
              {display.attachments?.length ? (
                <div className="flex flex-wrap gap-2 px-4 pb-3">
                  {display.attachments?.map((attachment) => (
                    <Badge key={attachment.id} variant="outline">
                      <Paperclip className="mr-1 size-3" />
                      {attachment.filename}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <EmailBody
                html={display.html}
                text={display.text}
                htmlFormat={display.html_format}
              />
              <div className="flex justify-end p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={replyDisabled}
                  onClick={() => onReply(display)}
                >
                  <Reply className="size-4" />
                  Reply
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </article>
  );
}
