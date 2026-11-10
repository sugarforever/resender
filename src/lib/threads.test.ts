import { describe, expect, it } from "vitest";
import {
  buildConversations,
  createReplyDraft,
  type ThreadMessage,
} from "./threads";

function message(
  id: string,
  extra: Partial<ThreadMessage> = {},
): ThreadMessage {
  return {
    id,
    message_id: `<${id}@example.com>`,
    direction: "received",
    from: "Person <person@example.com>",
    to: ["me@mydomain.com"],
    subject: "Greeting",
    created_at: "2026-11-10T09:00:00Z",
    ...extra,
  };
}

describe("conversation grouping", () => {
  it("stacks both directions chronologically using references, including missing ancestors", () => {
    const first = message("first");
    const sent = message("sent", {
      direction: "sent",
      headers: { "In-Reply-To": first.message_id! },
      created_at: "2026-11-10T09:01:00Z",
    });
    const last = message("last", {
      headers: {
        references: `${first.message_id} <missing@example.com>`,
        "in-reply-to": sent.message_id!,
      },
      created_at: "2026-11-10T09:02:00Z",
    });
    expect(
      buildConversations([last, sent, first]).map((thread) =>
        thread.messages.map((mail) => mail.id),
      ),
    ).toEqual([["first", "sent", "last"]]);
  });

  it("does not merge unrelated messages with identical subjects or missing IDs", () => {
    expect(
      buildConversations([
        message("a"),
        message("b"),
        message("c", { message_id: undefined }),
        message("d", { message_id: undefined }),
      ]),
    ).toHaveLength(4);
  });

  it("joins siblings sharing an ancestor outside the loaded window", () => {
    expect(
      buildConversations([
        message("a", { headers: { References: "<root@elsewhere.com>" } }),
        message("b", { headers: { "In-Reply-To": "<root@elsewhere.com>" } }),
      ]),
    ).toHaveLength(1);
  });

  it("orders conversations newest first and accepts Message-ID from headers", () => {
    const root = message("old", {
      message_id: undefined,
      headers: { "Message-ID": "<original@example.com>" },
    });
    const reply = message("new", {
      headers: { "In-Reply-To": "<original@example.com>" },
      created_at: "2026-11-10T10:00:00Z",
    });
    expect(
      buildConversations([message("unrelated"), root, reply])[0].messages.map(
        (mail) => mail.id,
      ),
    ).toEqual(["old", "new"]);
  });
});

describe("reply draft", () => {
  it("honors Reply-To, chooses the receiving address, and extends the reference chain", () => {
    const draft = createReplyDraft(
      message("parent", {
        reply_to: ["Support <reply@example.com>"],
        headers: { REFERENCES: "<root@example.com> <parent@example.com>" },
      }),
      "",
    );
    expect(draft).toEqual({
      from: "me@mydomain.com",
      to: "Support <reply@example.com>",
      subject: "Re: Greeting",
      headers: {
        "In-Reply-To": "<parent@example.com>",
        References: "<root@example.com> <parent@example.com>",
      },
    });
  });

  it("preserves a configured sender and avoids duplicate Re prefixes", () => {
    expect(
      createReplyDraft(
        message("a", { subject: "RE: Greeting" }),
        "Me <chosen@mydomain.com>",
      ),
    ).toMatchObject({
      from: "Me <chosen@mydomain.com>",
      subject: "RE: Greeting",
    });
  });

  it("keeps consecutive replies linked when sent mail has no Message-ID", () => {
    const original = message("original");
    const first = message("first-reply", {
      direction: "sent",
      message_id: undefined,
      headers: createReplyDraft(original, "").headers,
      created_at: "2026-11-10T09:01:00Z",
    });
    const second = message("second-reply", {
      direction: "sent",
      message_id: undefined,
      headers: createReplyDraft(first, "").headers,
      created_at: "2026-11-10T09:02:00Z",
    });
    expect(second.headers).toEqual({
      "In-Reply-To": original.message_id,
      References: original.message_id,
    });
    expect(buildConversations([original, first, second])).toHaveLength(1);
    expect(
      buildConversations([original, first, second])[0].messages.map(
        (mail) => mail.id,
      ),
    ).toEqual(["original", "first-reply", "second-reply"]);
  });

  it("does not fabricate headers from Resend's opaque API id", () => {
    expect(
      createReplyDraft(message("uuid", { message_id: undefined }), "").headers,
    ).toEqual({});
  });

  it("does not copy injected or malformed headers into a reply", () => {
    expect(
      createReplyDraft(
        message("a", {
          message_id: "<a@example.com>\r\nBcc: victim@example.com",
          headers: { References: "<valid@example.com>\r\nInjected: bad" },
        }),
        "",
      ).headers,
    ).toEqual({});
  });

  it("unfolds legitimate References headers while keeping the original ancestry", () => {
    expect(
      createReplyDraft(
        message("parent", {
          headers: {
            References: "<root@example.com>\r\n\t<previous@example.com>",
          },
        }),
        "",
      ).headers.References,
    ).toBe("<root@example.com> <previous@example.com> <parent@example.com>");
  });
});
