import { Mail, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ApiKeyForm } from "@/components/ApiKeyForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  onConfigured: () => void;
}

export function Onboarding({ onConfigured }: Props) {
  return (
    <div className="bg-muted/30 flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-2 flex size-11 items-center justify-center rounded-xl">
            <Mail className="size-5" />
          </div>
          <CardTitle className="text-xl">Welcome to Resender</CardTitle>
          <CardDescription>
            Connect your Resend account to read and send email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ApiKeyForm onSaved={onConfigured} submitLabel="Connect" />
          <button
            type="button"
            onClick={() => void openUrl("https://resend.com/api-keys")}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 self-start text-xs cursor-pointer"
          >
            <ExternalLink className="size-3.5" />
            Get an API key from the Resend dashboard
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
