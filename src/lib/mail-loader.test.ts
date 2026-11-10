import { afterEach, describe, expect, it, vi } from "vitest";
import { MailLoader } from "./mail-loader";
import { api } from "./api";
import type { ThreadMessage } from "./threads";

vi.mock("./api", () => ({ api: { getReceived: vi.fn(), getSent: vi.fn() } }));
const mail: ThreadMessage = {
  id: "one",
  direction: "received",
  from: "person@example.com",
  to: ["me@example.com"],
  created_at: "2026-11-10T09:00:00Z",
};
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("mail detail loading", () => {
  it("coalesces concurrent reads and caches message bodies", async () => {
    const body = { ...mail, subject: "Hello", text: "Body" };
    vi.mocked(api.getReceived).mockResolvedValue(body);
    const loader = new MailLoader(vi.fn());
    const first = loader.get(mail);
    const second = loader.get(mail);
    expect(await first).toMatchObject({ text: "Body" });
    expect(await second).toMatchObject({ text: "Body" });
    await loader.get(mail);
    expect(api.getReceived).toHaveBeenCalledTimes(1);
    loader.dispose();
  });

  it("paces calls and lets the selected message go before background work", async () => {
    vi.useFakeTimers();
    vi.mocked(api.getReceived).mockResolvedValue({ ...mail, subject: "Hello" });
    const loader = new MailLoader(vi.fn());
    const first = loader.get(mail, false);
    const background = loader.get({ ...mail, id: "background" }, false);
    const selected = loader.get({ ...mail, id: "selected" });
    await first;
    expect(api.getReceived).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(599);
    expect(api.getReceived).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await selected;
    expect(api.getReceived).toHaveBeenNthCalledWith(2, "selected");
    await vi.advanceTimersByTimeAsync(600);
    await background;
    expect(api.getReceived).toHaveBeenNthCalledWith(3, "background");
    loader.dispose();
  });

  it("allows retry after failure and discards in-flight results after disconnect", async () => {
    vi.useFakeTimers();
    vi.mocked(api.getReceived).mockRejectedValueOnce(new Error("Offline"));
    const updated = vi.fn();
    const loader = new MailLoader(updated);
    await expect(loader.get(mail)).rejects.toThrow("Offline");
    let complete!: (value: typeof mail & { subject: string }) => void;
    vi.mocked(api.getReceived).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const retry = loader.get(mail);
    const assertion = expect(retry).rejects.toThrow("Connection changed");
    await vi.advanceTimersByTimeAsync(600);
    loader.dispose();
    complete({ ...mail, subject: "Hello" });
    await assertion;
    expect(loader.peek(mail)).toBeUndefined();
    expect(updated).not.toHaveBeenCalled();
  });
});
