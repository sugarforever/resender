import { useEffect, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMessage } from "@/lib/api";
import { isValidAddress, parseAddressList } from "@/lib/format";
import { getDefaultFrom } from "@/lib/prefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ThreadMessage } from "@/lib/threads";
import { saveReplyLink } from "@/lib/reply-links";

export interface Draft {
  from?: string;
  headers?: Record<string, string>;
  to?: string;
  subject?: string;
}

interface Props {
  draft: Draft | null;
  onSent: (mail: ThreadMessage) => void;
  inline?: boolean;
  onCancel?: () => void;
}

export function ComposeView({
  draft,
  onSent,
  inline = false,
  onCancel,
}: Props) {
  const [from, setFrom] = useState(getDefaultFrom());
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Apply an incoming reply draft.
  useEffect(() => {
    if (!draft) return;
    if (draft.from !== undefined) setFrom(draft.from);
    if (draft.to !== undefined) setTo(draft.to);
    if (draft.subject !== undefined) setSubject(draft.subject);
  }, [draft]);

  const send = async () => {
    const fromTrim = from.trim();
    if (!isValidAddress(fromTrim)) {
      toast.error("Enter a valid 'From' address (e.g. you@yourdomain.com).");
      return;
    }
    const toList = parseAddressList(to);
    if (toList.length === 0) {
      toast.error("Add at least one recipient.");
      return;
    }
    const invalid = toList.find((a) => !isValidAddress(a));
    if (invalid) {
      toast.error(`Recipient "${invalid}" is not a valid address.`);
      return;
    }
    if (!subject.trim()) {
      toast.error("Add a subject.");
      return;
    }
    if (!body.trim()) {
      toast.error("Write a message before sending.");
      return;
    }

    setSending(true);
    try {
      const res = await api.sendEmail({
        from: fromTrim,
        to: toList,
        cc: parseAddressList(cc),
        bcc: parseAddressList(bcc),
        subject: subject.trim(),
        text: body,
        headers: draft?.headers,
      });
      if (draft?.headers && !saveReplyLink(res.id, draft.headers)) {
        toast.warning(
          "Email sent, but its conversation link could not be saved on this device.",
        );
      }
      toast.success("Email sent", { description: `Message id: ${res.id}` });
      // Reset, but keep the sender for the next message.
      setTo("");
      setCc("");
      setBcc("");
      setShowCc(false);
      setSubject("");
      setBody("");
      onSent({
        id: res.id,
        direction: "sent",
        from: fromTrim,
        to: toList,
        cc: parseAddressList(cc),
        subject: subject.trim(),
        text: body,
        headers: draft?.headers,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      toast.error("Couldn't send", { description: errMessage(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={inline ? "flex flex-col" : "flex h-full min-h-0 flex-col"}
      aria-label={inline ? "Reply composer" : "New message composer"}
    >
      <header className="flex h-14 items-center justify-between px-6">
        <h2 className="text-sm font-semibold">
          {inline ? "Reply" : "New message"}
        </h2>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              disabled={sending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button onClick={send} disabled={sending} size="sm">
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </header>
      <Separator />

      <ScrollArea className={inline ? "" : "min-h-0 flex-1"}>
        <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
          <Field label="From" htmlFor="from">
            <Input
              id="from"
              placeholder="You <you@yourdomain.com>"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field
            label="To"
            htmlFor="to"
            action={
              !showCc ? (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  Cc / Bcc
                </button>
              ) : undefined
            }
          >
            <Input
              id="to"
              placeholder="recipient@example.com, another@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoComplete="off"
            />
          </Field>

          {showCc && (
            <>
              <Field label="Cc" htmlFor="cc">
                <Input
                  id="cc"
                  placeholder="cc@example.com"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Bcc" htmlFor="bcc">
                <Input
                  id="bcc"
                  placeholder="bcc@example.com"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </>
          )}

          <Field label="Subject" htmlFor="subject">
            <Input
              id="subject"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field label="Message" htmlFor="body">
            <Textarea
              id="body"
              autoFocus={inline}
              placeholder="Write your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-64"
            />
          </Field>
        </div>
      </ScrollArea>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  action,
  children,
}: {
  label: string;
  htmlFor: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor}>{label}</Label>
        {action}
      </div>
      {children}
    </div>
  );
}
