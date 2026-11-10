export function normalizeDeliveryEvent(event?: string): string {
  return event?.replace(/^email\./, "") || "unknown";
}

export function isDeliveryPending(event?: string): boolean {
  return [
    "unknown",
    "queued",
    "sent",
    "delivery_delayed",
    "scheduled",
  ].includes(normalizeDeliveryEvent(event));
}
