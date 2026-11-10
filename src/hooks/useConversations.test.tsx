import { StrictMode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useConversations } from "./useConversations";
import { api } from "@/lib/api";
import type { ReceivedEmail, SentEmail } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  api: { getReceived: vi.fn(), getSent: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});
const received: ReceivedEmail = {
  id: "in",
  message_id: "<in@example.com>",
  from: "person@example.com",
  to: ["me@example.com"],
  subject: "Greeting",
  created_at: "2026-11-10T09:00:00Z",
};
const noSent: SentEmail[] = [];

it("hydrates correctly under StrictMode and groups an optimistic reply before server refresh", async () => {
  vi.mocked(api.getReceived).mockResolvedValue({
    ...received,
    text: "Original body",
  });
  vi.mocked(api.getSent).mockResolvedValue({
    id: "sent",
    message_id: "<sent@example.com>",
    from: "me@example.com",
    to: ["person@example.com"],
    created_at: "2026-11-10T09:01:00Z",
  });
  const inbox = [received];
  const { result, rerender } = renderHook(
    ({ sent }) => useConversations(inbox, sent),
    { initialProps: { sent: noSent }, wrapper: StrictMode },
  );
  await waitFor(() =>
    expect(result.current.conversations[0].messages[0].text).toBe(
      "Original body",
    ),
  );
  act(() =>
    result.current.addSent({
      id: "sent",
      direction: "sent",
      from: "me@example.com",
      to: ["person@example.com"],
      text: "My reply",
      headers: { "In-Reply-To": received.message_id! },
      created_at: "2026-11-10T09:01:00Z",
    }),
  );
  expect(result.current.conversations).toHaveLength(1);
  expect(result.current.conversations[0].messages).toHaveLength(2);
  rerender({
    sent: [
      {
        id: "sent",
        from: "me@example.com",
        to: ["person@example.com"],
        created_at: "2026-11-10T09:01:00Z",
      },
    ],
  });
  expect(result.current.conversations).toHaveLength(1);
  expect(result.current.conversations[0].messages).toHaveLength(2);
});
