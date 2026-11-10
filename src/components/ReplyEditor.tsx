import { useId, useMemo, useState } from "react";
import {
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Reply,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api, errMessage } from "@/lib/api";
import { isValidAddress, parseAddressList } from "@/lib/format";
import { getDefaultFrom } from "@/lib/prefs";
import { buildReplyBody, quotedOriginal } from "@/lib/reply-body";
import { saveReplyLink } from "@/lib/reply-links";
import { createReplyDraft, type ThreadMessage } from "@/lib/threads";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

export function ReplyEditor({
  original,
  onSent,
  onCancel,
}: {
  original: ThreadMessage;
  onSent: (mail: ThreadMessage) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [draft] = useState(() => createReplyDraft(original, getDefaultFrom()));
  const [from, setFrom] = useState(draft.from);
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [body, setBody] = useState("");
  const [details, setDetails] = useState(false);
  const [showQuote, setShowQuote] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quote = useMemo(() => quotedOriginal(original), [original]);

  const send = async () => {
    if (sending) return;
    const recipients = parseAddressList(to);
    const copied = parseAddressList(cc);
    const blind = parseAddressList(bcc);
    const invalid = [...recipients, ...copied, ...blind].find(
      (address) => !isValidAddress(address),
    );
    const fieldsError = !isValidAddress(from)
      ? "Enter a valid From address."
      : recipients.length === 0
        ? "Add a recipient."
        : invalid
          ? `Recipient "${invalid}" is not a valid address.`
          : !subject.trim()
            ? "Add a subject."
            : null;
    if (fieldsError || !body.trim()) {
      setError(fieldsError ?? "Write a message before sending.");
      if (fieldsError) setDetails(true);
      return;
    }
    setError(null);
    setSending(true);
    const content = buildReplyBody(body, original);
    try {
      const result = await api.sendEmail({
        from: from.trim(),
        to: recipients,
        cc: copied,
        bcc: blind,
        subject: subject.trim(),
        ...content,
        headers: draft.headers,
      });
      if (!saveReplyLink(result.id, draft.headers))
        toast.warning(
          "Email sent, but its conversation link could not be saved on this device.",
        );
      toast.success("Reply sent");
      onSent({
        id: result.id,
        direction: "sent",
        from: from.trim(),
        to: recipients,
        cc: copied,
        subject: subject.trim(),
        ...content,
        headers: draft.headers,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      setError(errMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-label="Reply composer" className="flex min-w-0 flex-col">
      <div className="flex items-center gap-3 px-4 py-3">
        <Reply className="text-muted-foreground size-4 shrink-0" />
        <button
          type="button"
          onClick={() => setDetails((value) => !value)}
          aria-label="Edit reply details"
          aria-expanded={details}
          aria-controls={`${id}-details`}
          title={`From ${from}\nTo ${to}\n${subject}`}
          className="hover:bg-accent focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded px-1 py-1 text-sm focus-visible:ring-2 cursor-pointer"
        >
          <span className="truncate">{to || "Add recipient"}</span>
          <ChevronDown className="size-3 shrink-0" />
        </button>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
          Reply
        </span>
      </div>
      {details && (
        <div
          id={`${id}-details`}
          className="grid gap-3 border-y bg-muted/20 p-4 sm:grid-cols-2"
        >
          {(
            [
              ["From", from, setFrom],
              ["To", to, setTo],
              ["Cc", cc, setCc],
              ["Bcc", bcc, setBcc],
              ["Subject", subject, setSubject],
            ] as const
          ).map(([label, value, setter]) => (
            <div
              key={label}
              className={label === "Subject" ? "sm:col-span-2" : ""}
            >
              <Label className="mb-1 block text-xs" htmlFor={`${id}-${label}`}>
                {label}
              </Label>
              <Input
                id={`${id}-${label}`}
                value={value}
                onChange={(event) => setter(event.target.value)}
                autoComplete="off"
                disabled={sending}
              />
            </div>
          ))}
        </div>
      )}
      <div className="max-h-[55vh] min-h-0 overflow-y-auto">
        <div className="focus-within:ring-brand/40 focus-within:ring-2 focus-within:ring-inset">
          <Label className="sr-only" htmlFor={`${id}-body`}>
            Message
          </Label>
          <Textarea
            id={`${id}-body`}
            autoFocus
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Write your reply…"
            disabled={sending}
            className="min-h-36 w-full resize-y rounded-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="mx-4 border-t py-3">
          <button
            type="button"
            aria-label={
              showQuote ? "Hide quoted message" : "Show quoted message"
            }
            aria-expanded={showQuote}
            onClick={() => setShowQuote((value) => !value)}
            className="text-muted-foreground hover:bg-accent focus-visible:ring-ring mb-2 flex items-center gap-2 rounded px-1 text-xs focus-visible:ring-2 cursor-pointer"
          >
            <MoreHorizontal className="size-4" />
            <span>{showQuote ? "Quoted message" : "Show quoted message"}</span>
          </button>
          {showQuote && (
            <div
              aria-label="Quoted original message"
              className="text-muted-foreground max-h-36 overflow-y-auto text-sm leading-relaxed"
            >
              <p className="mb-1 break-words">{quote.attribution}</p>
              <blockquote className="border-l-2 pl-3 break-words whitespace-pre-wrap">
                {quote.content}
              </blockquote>
            </div>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive px-4 pb-2 text-sm">
          {error}
        </p>
      )}
      <footer className="flex shrink-0 items-center justify-between border-t px-4 py-3">
        <Button onClick={() => void send()} disabled={sending} size="sm">
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {sending ? "Sending…" : "Send"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          disabled={sending}
          aria-label="Discard reply"
          title="Discard reply"
        >
          <Trash2 className="size-4" />
        </Button>
      </footer>
    </section>
  );
}
