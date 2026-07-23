export interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

export interface ListResponse<T> {
  object: string;
  has_more: boolean;
  data: T[];
}

/** A received (inbound) email as returned by the list endpoint. */
export interface ReceivedEmail {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string[];
  subject: string;
  created_at: string;
  message_id?: string;
  attachments?: Attachment[];
  // Present only when fetched individually:
  html?: string;
  text?: string;
}

/** A sent email as returned by the list endpoint. */
export interface SentEmail {
  id: string;
  from: string;
  to: string[];
  subject?: string;
  created_at: string;
  last_event?: string;
  // Present only when fetched individually:
  html?: string;
  text?: string;
}

/**
 * A structural view shared by inbox and sent rows for the reading UI.
 * Both {@link ReceivedEmail} and {@link SentEmail} are assignable to it.
 */
export interface Mail {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  subject?: string;
  created_at: string;
  last_event?: string;
  attachments?: Attachment[];
  html?: string;
  text?: string;
}

export interface SendEmailInput {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string[];
}

export interface SendResult {
  id: string;
}
