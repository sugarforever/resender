import { useState } from "react";
import { Bell, Palette, KeyRound, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMessage } from "@/lib/api";
import {
  MIN_POLL_SEC,
  getDefaultFrom,
  setDefaultFrom,
  type Theme,
} from "@/lib/prefs";
import { ApiKeyForm } from "@/components/ApiKeyForm";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  pollIntervalSec: number;
  onPollChange: (sec: number) => void;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onDisconnected: () => void;
  onKeySaved: () => void;
}

export function SettingsView({
  pollIntervalSec,
  onPollChange,
  theme,
  onThemeChange,
  onDisconnected,
  onKeySaved,
}: Props) {
  const [from, setFrom] = useState(getDefaultFrom());
  const [poll, setPoll] = useState(String(pollIntervalSec));
  const [disconnecting, setDisconnecting] = useState(false);

  const saveFrom = () => {
    setDefaultFrom(from);
    toast.success("Default sender saved.");
  };

  const commitPoll = () => {
    const n = Math.max(MIN_POLL_SEC, Math.round(Number(poll) || 60));
    setPoll(String(n));
    onPollChange(n);
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await api.deleteApiKey();
      toast.success("Disconnected. Your API key was removed from the keychain.");
      onDisconnected();
    } catch (e) {
      toast.error("Couldn't disconnect", { description: errMessage(e) });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 items-center px-6">
        <h1 className="text-sm font-semibold">Settings</h1>
      </header>
      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
          {/* Account / API key */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-4" />
                Account
              </CardTitle>
              <CardDescription>
                Update the Resend API key used by this app.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ApiKeyForm
                onSaved={onKeySaved}
                submitLabel="Update key"
                loadExisting
              />
              <Separator />
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium">Disconnect</p>
                  <p className="text-muted-foreground text-xs">
                    Remove the stored key from your keychain.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={disconnecting}
                    >
                      {disconnecting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Disconnect Resend account?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes your API key from the system keychain.
                        Resender will stop reading and sending mail until you
                        enter a key again. This can't be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={disconnect}
                        className={buttonVariants({ variant: "destructive" })}
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Sending */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sending</CardTitle>
              <CardDescription>
                Default sender address, prefilled when composing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defaultFrom">Default "From"</Label>
                <div className="flex gap-2">
                  <Input
                    id="defaultFrom"
                    placeholder="You <you@yourdomain.com>"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  <Button variant="outline" onClick={saveFrom}>
                    Save
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Must use a domain you've verified in Resend.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="size-4" />
                Notifications
              </CardTitle>
              <CardDescription>
                How often Resender checks for new mail and notifies you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="poll">Poll interval (seconds)</Label>
                <Input
                  id="poll"
                  type="number"
                  min={MIN_POLL_SEC}
                  value={poll}
                  onChange={(e) => setPoll(e.target.value)}
                  onBlur={commitPoll}
                  className="w-40"
                />
                <p className="text-muted-foreground text-xs">
                  Minimum {MIN_POLL_SEC}s. Well within Resend's 10 requests/sec
                  limit.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="size-4" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {(["light", "dark"] as Theme[]).map((t) => (
                  <Button
                    key={t}
                    variant={theme === t ? "default" : "outline"}
                    size="sm"
                    className="capitalize"
                    onClick={() => onThemeChange(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
