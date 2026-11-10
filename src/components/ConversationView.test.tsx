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
    expect(screen.queryByLabelText("From")).toBeNull();
    expect(screen.queryByLabelText("Subject")).toBeNull();
    expect(
      screen
        .getByRole("button", {
          name: /expand message from person@example.com/i,
        })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.getByLabelText("Message")).toBe(document.activeElement);
    expect(
      screen.getByLabelText("Quoted original message").textContent,
    ).toContain("How are you?");
    await user.click(
      screen.getByRole("button", { name: "Edit reply details" }),
    );
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
          text: expect.stringContaining("I'm fine, thanks."),
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
        text: expect.stringContaining("> How are you?"),
        html: expect.stringContaining("<blockquote"),
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
    await user.click(screen.getByRole("button", { name: "Discard reply" }));
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

  it("can hide the quote preview without excluding the original from the sent reply", async () => {
    const user = userEvent.setup();
    vi.mocked(api.sendEmail).mockResolvedValue({ id: "hidden-quote" });
    render(
      <ConversationView
        conversation={{ id: "one", messages: [original] }}
        fetchFull={fetchFull}
        onSent={vi.fn()}
      />,
    );
    await screen.findByText("How are you?");
    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByLabelText("Message"), "My reply");
    await user.click(
      screen.getByRole("button", { name: "Hide quoted message" }),
    );
    expect(screen.queryByLabelText("Quoted original message")).toBeNull();
    expect(screen.getByLabelText("Message")).toHaveProperty(
      "value",
      "My reply",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(api.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("> How are you?"),
        }),
      ),
    );
  });

  it("validates copied recipients and retains the reply text", async () => {
    const user = userEvent.setup();
    vi.mocked(api.sendEmail).mockClear();
    render(
      <ConversationView
        conversation={{ id: "one", messages: [original] }}
        fetchFull={fetchFull}
        onSent={vi.fn()}
      />,
    );
    await screen.findByText("How are you?");
    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByLabelText("Message"), "Keep my text");
    await user.click(
      screen.getByRole("button", { name: "Edit reply details" }),
    );
    await user.type(screen.getByLabelText("Cc", { exact: true }), "invalid");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "not a valid address",
    );
    expect(api.sendEmail).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Message")).toHaveProperty(
      "value",
      "Keep my text",
    );
  });

  it("updates outgoing status from fresh summaries rather than the cached message body", async () => {
    const queued = { ...response, last_event: "queued" };
    const fetchQueued = async () => queued;
    const { rerender } = render(
      <ConversationView
        conversation={{ id: "status", messages: [queued] }}
        fetchFull={fetchQueued}
        onSent={vi.fn()}
      />,
    );
    await screen.findByText("Doing well!");
    expect(screen.getByRole("img", { name: /Queued/ })).toBeTruthy();
    expect(screen.queryByText(/· Sent/)).toBeNull();
    rerender(
      <ConversationView
        conversation={{
          id: "status",
          messages: [{ ...queued, last_event: "delivered" }],
        }}
        fetchFull={fetchQueued}
        onSent={vi.fn()}
      />,
    );
    expect(screen.getByRole("img", { name: /Delivered/ })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Queued/ })).toBeNull();
  });
});
