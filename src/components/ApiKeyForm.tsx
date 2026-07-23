import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { api, errMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onSaved: () => void;
  submitLabel?: string;
  /** Prefill the field with the currently stored key (so the eye reveals it). */
  loadExisting?: boolean;
}

export function ApiKeyForm({
  onSaved,
  submitLabel = "Save & connect",
  loadExisting = false,
}: Props) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loadExisting) return;
    let active = true;
    api
      .revealApiKey()
      .then((k) => {
        if (active && k) setKey(k);
      })
      .catch(() => {
        /* non-fatal: leave the field empty */
      });
    return () => {
      active = false;
    };
  }, [loadExisting]);

  const save = async () => {
    if (!key.trim()) {
      toast.error("Paste your Resend API key first.");
      return;
    }
    setSaving(true);
    try {
      await api.saveApiKey(key.trim());
      toast.success("API key saved securely.");
      if (!loadExisting) setKey("");
      onSaved();
    } catch (e) {
      toast.error("Couldn't save key", { description: errMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="apikey">Resend API key</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="apikey"
              type={show ? "text" : "password"}
              placeholder="re_xxxxxxxxxxxxxxxxxxxx"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !saving && save()}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="pr-9 pl-9 font-mono"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm cursor-pointer"
              aria-label={show ? "Hide key" : "Show key"}
            >
              {show ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Use a <span className="font-medium">Full access</span> key so Resender
        can read your inbox and sent mail. It's stored in your operating
        system's keychain and never leaves this device except to call Resend.
      </p>
    </div>
  );
}
