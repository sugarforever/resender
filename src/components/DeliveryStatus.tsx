import {
  Ban,
  CalendarClock,
  CheckCheck,
  CircleHelp,
  CircleX,
  Clock,
  LoaderCircle,
  MailOpen,
  MailX,
  MousePointer2,
  Send,
  ShieldAlert,
} from "lucide-react";
import { normalizeDeliveryEvent } from "@/lib/delivery-status";

const statuses: Record<
  string,
  {
    icon: typeof Send;
    label: string;
    description: string;
    color: string;
    animation?: string;
  }
> = {
  queued: {
    icon: LoaderCircle,
    label: "Queued",
    description: "Accepted by Resend; waiting to be sent.",
    color: "text-amber-600 dark:text-amber-400",
    animation: "motion-safe:animate-spin",
  },
  sent: {
    icon: Send,
    label: "Sent",
    description: "Sent by Resend; delivery is not confirmed yet.",
    color: "text-blue-600 dark:text-blue-400",
  },
  delivered: {
    icon: CheckCheck,
    label: "Delivered",
    description: "Accepted by the recipient's mail server.",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  opened: {
    icon: MailOpen,
    label: "Opened",
    description: "An email open was reported; open tracking may be inaccurate.",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  clicked: {
    icon: MousePointer2,
    label: "Clicked",
    description: "A link click was reported for this email.",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  delivery_delayed: {
    icon: Clock,
    label: "Delivery delayed",
    description: "Delivery is delayed; Resend is retrying automatically.",
    color: "text-amber-600 dark:text-amber-400",
    animation: "motion-safe:animate-pulse",
  },
  scheduled: {
    icon: CalendarClock,
    label: "Scheduled",
    description: "Waiting for the scheduled sending time.",
    color: "text-muted-foreground",
  },
  bounced: {
    icon: MailX,
    label: "Bounced",
    description: "The recipient's mail server rejected the email.",
    color: "text-destructive",
  },
  failed: {
    icon: CircleX,
    label: "Failed",
    description: "Resend could not send this email.",
    color: "text-destructive",
  },
  complained: {
    icon: ShieldAlert,
    label: "Spam complaint",
    description: "The recipient marked this email as spam.",
    color: "text-amber-600 dark:text-amber-400",
  },
  suppressed: {
    icon: Ban,
    label: "Suppressed",
    description: "Not sent because the recipient is on the suppression list.",
    color: "text-amber-600 dark:text-amber-400",
  },
  canceled: {
    icon: Ban,
    label: "Canceled",
    description: "This scheduled email was canceled.",
    color: "text-muted-foreground",
  },
};

export function DeliveryStatus({ event }: { event?: string }) {
  const key = normalizeDeliveryEvent(event);
  const state = statuses[key] ?? {
    icon: CircleHelp,
    label: "Unknown",
    description: event
      ? `Unrecognized delivery status: ${event}.`
      : "Delivery status is not available yet.",
    color: "text-muted-foreground",
  };
  const Icon = state.icon;
  const explanation = `${state.label} — ${state.description}`;
  return (
    <span
      role="img"
      aria-label={explanation}
      title={explanation}
      tabIndex={0}
      className={`mr-4 inline-flex size-7 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${state.color}`}
    >
      <Icon aria-hidden="true" className={`size-4 ${state.animation ?? ""}`} />
    </span>
  );
}
