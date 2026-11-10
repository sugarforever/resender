import { afterEach, describe, expect, it, vi } from "vitest";
import { loadReplyLinks, saveReplyLink } from "./reply-links";

afterEach(() => localStorage.clear());
describe("outgoing reply links", () => {
  it("restores reply links across reloads without storing bodies", () => {
    const headers = {
      "In-Reply-To": "<parent@example.com>",
      References: "<root@example.com> <parent@example.com>",
    };
    expect(saveReplyLink("sent-id", headers)).toBe(true);
    expect(loadReplyLinks()).toEqual({ "sent-id": headers });
    expect(JSON.parse(localStorage.getItem("resender.replyLinks.v1")!)).toEqual(
      { "sent-id": headers },
    );
  });
  it("ignores corrupted or unexpected stored values", () => {
    localStorage.setItem(
      "resender.replyLinks.v1",
      '{"bad":{"body":"private"},"invalid":{"References":3}}',
    );
    expect(loadReplyLinks()).toEqual({});
    localStorage.setItem("resender.replyLinks.v1", "not json");
    expect(loadReplyLinks()).toEqual({});
  });
  it("reports storage failure without throwing after an email was already sent", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    expect(
      saveReplyLink("sent-id", { References: "<parent@example.com>" }),
    ).toBe(false);
  });
});
