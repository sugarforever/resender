import type { Conversation, ThreadMessage } from "@/lib/threads";
import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Reply,
  Paperclip,
} from "lucide-react";
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
  parseAddress,
} from "@/lib/format";
import { messageId } from "@/lib/threads";
import { quotedOriginal } from "@/lib/reply-body";
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
  const [middleOpen, setMiddleOpen] = useState(false);
  const middleId = useId();
  const composerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (replyTarget)
      composerRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
  }, [replyTarget]);
  const last = conversation.messages[conversation.messages.length - 1];
  const middle = conversation.messages.slice(1, -2);
  const renderMessage = (mail: ThreadMessage) => {
    const key = `${mail.direction}:${mail.id}`;
    const isExpanded = mail === last ? !replyTarget : (expanded[key] ?? false);
    return (
      <MessageCard
        key={key}
        mail={mail}
        expanded={isExpanded}
        canCollapse={mail !== last}
        fetchFull={fetchFull}
        onToggle={() =>
          setExpanded((current) => ({ ...current, [key]: !isExpanded }))
        }
        onReply={(target) => {
          setExpanded(
            Object.fromEntries(
              conversation.messages.map((message) => [
                `${message.direction}:${message.id}`,
                false,
              ]),
            ),
          );
          setReplyTarget(target);
        }}
        replyDisabled={!!replyTarget}
      />
    );
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 shrink-0 flex-wrap items-baseline gap-x-3 px-6 py-4">
        <h2 className="text-[18px] leading-[26px] font-semibold">
          {conversation.messages[0].subject || "(no subject)"}
        </h2>
        <p className="text-muted-foreground text-xs">
          {conversation.messages.length}{" "}
          {conversation.messages.length === 1 ? "message" : "messages"}
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="conversation-content">
          {middle.length > 0 ? (
            <>
              {renderMessage(conversation.messages[0])}
              <div>
                {!middleOpen && (
                  <div className="thread-count-row">
                    <button
                      type="button"
                      aria-label={`Show ${middle.length} earlier ${middle.length === 1 ? "message" : "messages"}`}
                      aria-expanded={false}
                      aria-controls={middleId}
                      onClick={() => setMiddleOpen(true)}
                      className="group text-muted-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-ring relative flex size-8 cursor-pointer items-center justify-center rounded-full border text-xs font-medium focus-visible:outline-2"
                    >
                      <span className="group-hover:hidden group-focus-visible:hidden">
                        {middle.length}
                      </span>
                      <span
                        aria-hidden="true"
                        className="hidden flex-col items-center group-hover:flex group-focus-visible:flex"
                      >
                        <ChevronUp className="size-3.5" />
                        <ChevronDown className="-mt-1 size-3.5" />
                      </span>
                    </button>
                  </div>
                )}
                <div id={middleId} className="">
                  {middleOpen && middle.map((mail) => renderMessage(mail))}
                </div>
              </div>
              {conversation.messages
                .slice(-2)
                .map((mail) => renderMessage(mail))}
            </>
          ) : (
            conversation.messages.map((mail) => renderMessage(mail))
          )}
          {replyTarget && (
            <div
              ref={composerRef}
              className="reply-frame overflow-hidden bg-background"
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
  canCollapse,
}: {
  mail: ThreadMessage;
  expanded: boolean;
  canCollapse: boolean;
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
  const Header = canCollapse ? "button" : "div";
  return (
    <article className="message-card" data-expanded={expanded}>
      <div className="flex items-start">
        <Header
          type={canCollapse ? "button" : undefined}
          onClick={canCollapse ? onToggle : undefined}
          aria-expanded={canCollapse ? expanded : undefined}
          aria-label={
            canCollapse
              ? `${expanded ? "Collapse" : "Expand"} message from ${display.from}`
              : undefined
          }
          className="message-header hover:bg-accent/30 focus-visible:outline-ring flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        >
          <span className="message-avatar bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
            {initials(display.from)}
          </span>
          <span className="message-identity min-w-0 flex-1">
            <span className="truncate text-[13px] font-semibold">
              {displayName(display.from)}
            </span>
            {expanded && (
              <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                <span className="block truncate">
                  {parseAddress(display.from).email}
                </span>
                To {joinAddresses(display.to)}
              </span>
            )}
            {!expanded && (
              <span className="message-preview text-muted-foreground mt-0.5 block truncate text-xs">
                {(
                  display.text?.trim() ||
                  (display.html ? quotedOriginal(display).content : "")
                )
                  .split(/\r?\n/)
                  .find((line) => line.trim())
                  ?.trim()}
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
          {canCollapse &&
            (expanded ? (
              <ChevronDown className="message-chevron text-muted-foreground size-3.5 shrink-0" />
            ) : (
              <ChevronRight className="message-chevron text-muted-foreground size-3.5 shrink-0" />
            ))}
        </Header>
        {mail.direction === "sent" && (
          <DeliveryStatus event={display.last_event} showLabel={expanded} />
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
              <div className="message-body">
                <EmailBody
                  html={display.html}
                  text={display.text}
                  htmlFormat={display.html_format}
                />
              </div>
              <div className="flex px-4 pb-4 pt-1">
                <Button
                  variant="outline"
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
