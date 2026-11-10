import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MailboxView } from "./MailboxView";
import { buildConversations, type ThreadMessage } from "@/lib/threads";

beforeAll(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const original: ThreadMessage = {
  id: "original",
  message_id: "<original@example.com>",
  direction: "received",
  from: "person@example.com",
  to: ["me@mydomain.com"],
  subject: "Greeting",
  text: "Original message",
  created_at: "2026-11-10T09:00:00Z",
};
const fetchFull = async (mail: ThreadMessage) => mail;
const onOpen = vi.fn();
const view = (messages: ThreadMessage[]) => (
  <MailboxView
    kind="inbox"
    conversations={buildConversations(messages)}
    indexing={false}
    incomplete={false}
    onRetryIndex={vi.fn()}
    onSent={vi.fn()}
    loading={false}
    error={null}
    onRefresh={vi.fn()}
    fetchFull={fetchFull}
    onOpen={onOpen}
  />
);

it("keeps the selected conversation and draft when a new reply changes the list row", async () => {
  const user = userEvent.setup();
  const { rerender } = render(view([original]));
  await screen.findByText("Original message");
  await user.click(screen.getByRole("button", { name: "Reply" }));
  await user.type(screen.getByLabelText("Message"), "Draft in progress");
  const newer: ThreadMessage = {
    ...original,
    id: "newer",
    message_id: "<newer@example.com>",
    headers: { "In-Reply-To": original.message_id! },
    text: "A follow-up",
    created_at: "2026-11-10T09:01:00Z",
  };
  rerender(view([original, newer]));
  expect(screen.getByText("A follow-up")).toBeTruthy();
  expect(screen.getByLabelText("Message")).toHaveProperty(
    "value",
    "Draft in progress",
  );
  await user.click(within(screen.getByRole("list")).getByRole("button"));
  expect(screen.getByLabelText("Message")).toHaveProperty(
    "value",
    "Draft in progress",
  );
  expect(onOpen).toHaveBeenCalledWith("original");
  expect(onOpen).toHaveBeenCalledWith("newer");
});

it("does not carry a reply draft into an unrelated conversation", async () => {
  const user = userEvent.setup();
  const other: ThreadMessage = {
    ...original,
    id: "other",
    message_id: "<other@example.com>",
    from: "other@example.com",
    text: "Unrelated message",
    subject: "Different topic",
    created_at: "2026-11-10T08:00:00Z",
  };
  render(view([original, other]));
  await screen.findByText("Original message");
  await user.click(screen.getByRole("button", { name: "Reply" }));
  await user.type(screen.getByLabelText("Message"), "Private draft");
  await user.click(
    within(screen.getByRole("list")).getByRole("button", {
      name: /other@example.com/,
    }),
  );
  await screen.findByText("Unrelated message");
  expect(screen.queryByLabelText("Reply composer")).toBeNull();
});
