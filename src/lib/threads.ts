import type { Mail } from "./types";
import { toDate } from "./format";

export interface ThreadMessage extends Mail {
  direction: "received" | "sent";
}

export interface Conversation {
  id: string;
  messages: ThreadMessage[];
}

export interface ReplyDraft {
  from: string;
  to: string;
  subject: string;
  headers: Record<string, string>;
}

export function header(mail: Mail, name: string): string {
  return (
    Object.entries(mail.headers ?? {}).find(
      ([key]) => key.toLowerCase() === name.toLowerCase(),
    )?.[1] ?? ""
  );
}

function messageIds(value: string): string[] {
  const unfolded = value.replace(/\r?\n[\t ]+/g, " ");
  if (/[\r\n]/.test(unfolded)) return [];
  return unfolded.match(/<[^<>\s]+@[^<>\s]+>/g) ?? [];
}

export function messageId(mail: Mail): string | undefined {
  const value = mail.message_id || header(mail, "message-id");
  if (/^[^<>\s]+@[^<>\s]+$/.test(value)) return `<${value}>`;
  return messageIds(value)[0];
}

export function buildConversations(messages: ThreadMessage[]): Conversation[] {
  const parents = new Map<string, string>();
  function root(id: string): string {
    const parent = parents.get(id);
    if (!parent) {
      parents.set(id, id);
      return id;
    }
    if (parent === id) return id;
    const result = root(parent);
    parents.set(id, result);
    return result;
  }
  function tokens(mail: ThreadMessage): string[] {
    return [
      `${mail.direction}:${mail.id}`,
      ...[messageId(mail)].filter((id): id is string => !!id),
      ...messageIds(header(mail, "in-reply-to")),
      ...messageIds(header(mail, "references")),
    ];
  }
  for (const mail of messages) {
    const ids = tokens(mail);
    for (const id of ids.slice(1)) parents.set(root(id), root(ids[0]));
  }
  const groups = new Map<string, ThreadMessage[]>();
  for (const mail of messages) {
    const id = root(`${mail.direction}:${mail.id}`);
    const group = groups.get(id) ?? [];
    if (
      !group.some(
        (item) => item.id === mail.id && item.direction === mail.direction,
      )
    )
      group.push(mail);
    groups.set(id, group);
  }
  const time = (mail: ThreadMessage) => toDate(mail.created_at).getTime() || 0;
  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      messages: group.sort((a, b) => time(a) - time(b)),
    }))
    .sort(
      (a, b) =>
        time(b.messages[b.messages.length - 1]) -
        time(a.messages[a.messages.length - 1]),
    );
}

export function createReplyDraft(
  mail: ThreadMessage,
  defaultFrom: string,
): ReplyDraft {
  const parent = messageId(mail);
  const references = [
    ...new Set([
      ...messageIds(header(mail, "references") || header(mail, "in-reply-to")),
      ...(parent ? [parent] : []),
    ]),
  ];
  return {
    from:
      defaultFrom ||
      (mail.direction === "received" ? (mail.to[0] ?? "") : mail.from),
    to:
      mail.direction === "sent"
        ? mail.to.join(", ")
        : mail.reply_to?.filter(Boolean).join(", ") ||
          header(mail, "reply-to") ||
          mail.from,
    subject: /^re\s*:/i.test(mail.subject ?? "")
      ? mail.subject!
      : `Re: ${mail.subject || "(no subject)"}`,
    headers: parent
      ? { "In-Reply-To": parent, References: references.join(" ") }
      : {},
  };
}
