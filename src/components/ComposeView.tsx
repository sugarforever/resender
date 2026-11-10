import { useState, type ReactNode } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMessage } from "@/lib/api";
import { isValidAddress, parseAddressList } from "@/lib/format";
import { getDefaultFrom } from "@/lib/prefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ThreadMessage } from "@/lib/threads";

type FieldName = "From" | "To" | "Cc" | "Bcc" | "Subject" | "Message";
interface Props {
  onSent: (mail: ThreadMessage) => void;
}

export function ComposeView({ onSent }: Props) {
  const [from, setFrom] = useState(getDefaultFrom());
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const clearError = (field: FieldName) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
  };

  const send = async () => {
    if (sending) return;
    const toList = parseAddressList(to);
    const ccList = parseAddressList(cc);
    const bccList = parseAddressList(bcc);
    const invalid: Partial<Record<FieldName, string>> = {};
    if (!isValidAddress(from.trim()))
      invalid.From = "Enter a valid From address.";
    if (!toList.length) invalid.To = "Add at least one recipient.";
    for (const [field, addresses] of [
      ["To", toList],
      ["Cc", ccList],
      ["Bcc", bccList],
    ] as const) {
      if (addresses.some((address) => !isValidAddress(address)))
        invalid[field] = "Enter a valid address for every recipient.";
    }
    if (!subject.trim()) invalid.Subject = "Add a subject.";
    if (!body.trim()) invalid.Message = "Write a message before sending.";
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      if (invalid.Cc || invalid.Bcc) setShowCc(true);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await api.sendEmail({
        from: from.trim(),
        to: toList,
        cc: ccList,
        bcc: bccList,
        subject: subject.trim(),
        text: body,
      });
      toast.success("Email submitted to Resend", {
        description: "Delivery is not confirmed yet.",
      });
      onSent({
        id: result.id,
        direction: "sent",
        from: from.trim(),
        to: toList,
        cc: ccList,
        subject: subject.trim(),
        text: body,
        created_at: new Date().toISOString(),
      });
      setTo("");
      setCc("");
      setBcc("");
      setShowCc(false);
      setSubject("");
      setBody("");
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setSending(false);
    }
  };
  const fieldProps = (field: FieldName) => ({
    disabled: sending,
    "aria-invalid": !!errors[field],
    "aria-describedby": errors[field] ? `compose-${field}-error` : undefined,
  });

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label="New message composer"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          void send();
        }
      }}
    >
      <header className="flex h-14 shrink-0 items-center border-b px-6">
        <h1 className="text-[15px] font-semibold">New message</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="compose-fields mx-auto flex min-h-full max-w-[840px] flex-col px-6 py-4">
          <Field label="From" error={errors.From}>
            <Input
              id="compose-From"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                clearError("From");
              }}
              placeholder="You <you@yourdomain.com>"
              autoComplete="off"
              {...fieldProps("From")}
            />
          </Field>
          <Field
            label="To"
            error={errors.To}
            action={
              !showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cc / Bcc
                </button>
              )
            }
          >
            <Input
              id="compose-To"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                clearError("To");
              }}
              placeholder="recipient@example.com"
              autoComplete="off"
              {...fieldProps("To")}
            />
          </Field>
          {showCc && (
            <>
              <Field label="Cc" error={errors.Cc}>
                <Input
                  id="compose-Cc"
                  value={cc}
                  onChange={(e) => {
                    setCc(e.target.value);
                    clearError("Cc");
                  }}
                  autoComplete="off"
                  {...fieldProps("Cc")}
                />
              </Field>
              <Field label="Bcc" error={errors.Bcc}>
                <Input
                  id="compose-Bcc"
                  value={bcc}
                  onChange={(e) => {
                    setBcc(e.target.value);
                    clearError("Bcc");
                  }}
                  autoComplete="off"
                  {...fieldProps("Bcc")}
                />
              </Field>
            </>
          )}
          <Field label="Subject" error={errors.Subject}>
            <Input
              id="compose-Subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                clearError("Subject");
              }}
              placeholder="Subject"
              {...fieldProps("Subject")}
            />
          </Field>
          <Label htmlFor="compose-Message" className="sr-only">
            Message
          </Label>
          <Textarea
            id="compose-Message"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              clearError("Message");
            }}
            placeholder="Write your message…"
            className="mt-3 min-h-64 flex-1 resize-none rounded-none border-0 px-0 py-3 text-[15px] leading-6 shadow-none focus-visible:ring-0 md:text-[15px]"
            {...fieldProps("Message")}
          />
          {errors.Message && (
            <p
              id="compose-Message-error"
              role="alert"
              className="py-2 text-xs text-destructive"
            >
              {errors.Message}
            </p>
          )}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="border-t bg-bad-soft px-6 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <footer className="flex shrink-0 items-center gap-3 border-t bg-muted/20 px-6 py-3">
        <Button onClick={() => void send()} disabled={sending} size="sm">
          {sending ? (
            <Loader2 className="size-4 motion-safe:animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {sending ? "Sending…" : "Send"}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          ⌘↵ / Ctrl+Enter
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Plain text
        </span>
      </footer>
    </section>
  );
}

function Field({
  label,
  error,
  action,
  children,
}: {
  label: FieldName;
  error?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="compose-field">
      <div className="flex items-center gap-4">
        <Label htmlFor={`compose-${label}`} className="w-14 shrink-0">
          {label}
        </Label>
        <div className="min-w-0 flex-1">{children}</div>
        {action}
      </div>
      {error && (
        <p
          id={`compose-${label}-error`}
          role="alert"
          className="pb-1 pl-[72px] text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
