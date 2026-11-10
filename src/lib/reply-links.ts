const STORAGE_KEY = "resender.replyLinks.v1";
type ReplyLinks = Record<string, Record<string, string>>;

export function loadReplyLinks(): ReplyLinks {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "{}",
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, headers]) =>
          headers &&
          typeof headers === "object" &&
          !Array.isArray(headers) &&
          Object.entries(headers).every(
            ([key, v]) =>
              ["In-Reply-To", "References"].includes(key) &&
              typeof v === "string" &&
              !/[\r\n]/.test(v),
          ),
      ),
    );
  } catch {
    return {};
  }
}

/** Persist only reply links, never bodies or credentials. Keep at most 1,000. */
export function saveReplyLink(
  id: string,
  headers: Record<string, string>,
): boolean {
  try {
    const links = loadReplyLinks();
    links[id] = headers;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(Object.entries(links).slice(-1000))),
    );
    return true;
  } catch {
    return false;
  }
}
