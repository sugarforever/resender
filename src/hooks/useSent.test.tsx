import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSent } from "./useSent";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { listSent: vi.fn() },
  errMessage: (error: unknown) => String(error),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("refreshes pending deliveries and slows polling once delivered without flashing loading", async () => {
  vi.useFakeTimers();
  const mail = {
    id: "sent",
    from: "me@example.com",
    to: ["person@example.com"],
    created_at: "2026-11-10T09:00:00Z",
  };
  vi.mocked(api.listSent)
    .mockResolvedValueOnce({
      object: "list",
      has_more: false,
      data: [{ ...mail, last_event: "queued" }],
    })
    .mockResolvedValue({
      object: "list",
      has_more: false,
      data: [{ ...mail, last_event: "delivered" }],
    });
  const { result, rerender } = renderHook(({ enabled }) => useSent(enabled), {
    initialProps: { enabled: true },
  });
  await act(() => result.current.refresh());
  expect(result.current.emails[0].last_event).toBe("queued");
  await act(() => vi.advanceTimersByTimeAsync(10_000));
  expect(result.current.emails[0].last_event).toBe("delivered");
  expect(result.current.loading).toBe(false);
  await act(() => vi.advanceTimersByTimeAsync(59_000));
  expect(api.listSent).toHaveBeenCalledTimes(2);
  await act(() => vi.advanceTimersByTimeAsync(1_000));
  expect(api.listSent).toHaveBeenCalledTimes(3);
  rerender({ enabled: false });
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(api.listSent).toHaveBeenCalledTimes(3);
});
