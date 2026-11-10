import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationView } from "./ConversationView";
import { api } from "@/lib/api";
import type { Conversation, ThreadMessage } from "@/lib/threads";

vi.mock("@/lib/api", () => ({
  api: { sendEmail: vi.fn() },
  errMessage: (error: unknown) => String(error),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
beforeAll(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
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
  text: "How are you?",
  created_at: "2026-11-10T09:00:00Z",
};
const response: ThreadMessage = {
  ...original,
  id: "response",
  message_id: "<response@example.com>",
  direction: "sent",
  from: "me@mydomain.com",
  to: ["person@example.com"],
  text: "Doing well!",
  created_at: "2026-11-10T09:01:00Z",
  headers: { "In-Reply-To": original.message_id! },
};
const conversation: Conversation = {
  id: "thread",
  messages: [original, response],
};
const fetchFull = async (mail: ThreadMessage) => mail;

describe("conversation reading and replying", () => {
  it("collapses older messages and expands them on demand", async () => {
    const user = userEvent.setup();
    render(
      <ConversationView
        conversation={conversation}
        fetchFull={fetchFull}
        onSent={vi.fn()}
      />,
    );
    await screen.findByText("Doing well!");
    expect(screen.queryByText("How are you?")).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: /expand message from person@example.com/i,
      }),
    );
    expect(await screen.findByText("How are you?")).toBeTruthy();
  });

  it("replies inline, sends threading headers, and returns the sent message to the same conversation", async () => {
    const user = userEvent.setup();
    const onSent = vi.fn();
    vi.mocked(api.sendEmail).mockResolvedValue({ id: "new-sent" });
    render(
      <ConversationView
        conversation={{ id: "one", messages: [original] }}
        fetchFull={fetchFull}
        onSent={onSent}
      />,
    );
    await screen.findByText("How are you?");
    await user.click(screen.getByRole("button", { name: "Reply" }));
    expect(screen.getByLabelText("To")).toHaveProperty(
      "value",
      "person@example.com",
    );
    expect(screen.getByLabelText("From")).toHaveProperty(
      "value",
      "me@mydomain.com",
    );
    expect(screen.getByText("How are you?")).toBeTruthy();
    await user.type(screen.getByLabelText("Message"), "I'm fine, thanks.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(onSent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "new-sent",
          direction: "sent",
          text: "I'm fine, thanks.",
          headers: {
            "In-Reply-To": original.message_id,
            References: original.message_id,
          },
        }),
      ),
    );
    expect(api.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Re: Greeting",
        headers: {
          "In-Reply-To": original.message_id,
          References: original.message_id,
        },
      }),
    );
    expect(screen.queryByLabelText("Reply composer")).toBeNull();
  });

  it("preserves a failed reply draft and lets the user cancel it", async () => {
    const user = userEvent.setup();
    vi.mocked(api.sendEmail).mockRejectedValue(new Error("Offline"));
    render(
      <ConversationView
        conversation={{ id: "one", messages: [original] }}
        fetchFull={fetchFull}
        onSent={vi.fn()}
      />,
    );
    await screen.findByText("How are you?");
    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByLabelText("Message"), "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send" })).toHaveProperty(
        "disabled",
        false,
      ),
    );
    expect(screen.getByLabelText("Message")).toHaveProperty(
      "value",
      "Keep this draft",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Reply composer")).toBeNull();
  });

  it("keeps HTML emails sandboxed", async () => {
    render(
      <ConversationView
        conversation={{
          id: "html",
          messages: [
            { ...original, html: "<script>alert(1)</script><p>Hello</p>" },
          ],
        }}
        fetchFull={fetchFull}
        onSent={vi.fn()}
      />,
    );
    const iframe = await screen.findByTitle("Email content");
    expect(iframe.getAttribute("sandbox")).toBe("");
  });
});
