export interface Attachment {
  content_disposition?: "inline" | "attachment" | null;
  content_id?: string | null;
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

export interface Domain {
  id: string;
  name: string;
  status: string;
  region: string;
}

/** A received (inbound) email as returned by the list endpoint. */
export interface ReceivedEmail {
  html_format?: "data_uri" | "cid";
  headers?: Record<string, string>;
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
  html?: string | null;
  text?: string | null;
}

/** A sent email as returned by the list endpoint. */
export interface SentEmail {
  message_id?: string;
  headers?: Record<string, string>;
  id: string;
  from: string;
  to: string[];
  subject?: string;
  created_at: string;
  last_event?: string;
  // Present only when fetched individually:
  html?: string | null;
  text?: string | null;
}

/**
 * A structural view shared by inbox and sent rows for the reading UI.
 * Both {@link ReceivedEmail} and {@link SentEmail} are assignable to it.
 */
export interface Mail {
  html_format?: "data_uri" | "cid";
  message_id?: string;
  headers?: Record<string, string>;
  reply_to?: string[];
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  subject?: string;
  created_at: string;
  last_event?: string;
  attachments?: Attachment[];
  html?: string | null;
  text?: string | null;
}

export interface SendEmailInput {
  headers?: Record<string, string>;
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
