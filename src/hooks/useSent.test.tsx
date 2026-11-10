import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSent } from "./useSent";
import { api } from "@/lib/api";

const nativeFocus = vi.hoisted(() => ({
  listener: null as null | ((event: { payload: boolean }) => void),
  unlisten: vi.fn(),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onFocusChanged: async (listener: (event: { payload: boolean }) => void) => {
      nativeFocus.listener = listener;
      return nativeFocus.unlisten;
    },
  }),
}));

vi.mock("@/lib/api", () => ({
  api: { listSent: vi.fn() },
  errMessage: (error: unknown) => String(error),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  nativeFocus.listener = null;
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
  await act(async () => {});
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

it("syncs immediately on native window focus without waiting for a throttled webview timer", async () => {
  const mail = {
    id: "focus",
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
  const { result, unmount } = renderHook(() => useSent(true));
  await act(async () => {});
  expect(result.current.emails[0]?.last_event).toBe("queued");
  await act(async () => {
    nativeFocus.listener?.({ payload: true });
  });
  expect(result.current.emails[0]?.last_event).toBe("delivered");
  unmount();
  expect(nativeFocus.unlisten).toHaveBeenCalled();
});

it("runs one trailing refresh when a focus event arrives during an outstanding request", async () => {
  let complete!: (value: {
    object: string;
    has_more: boolean;
    data: [];
  }) => void;
  vi.mocked(api.listSent)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue({ object: "list", has_more: false, data: [] });
  renderHook(() => useSent(true));
  await act(async () => {});
  await act(async () => {
    nativeFocus.listener?.({ payload: true });
  });
  await act(async () => {
    complete({ object: "list", has_more: false, data: [] });
  });
  expect(api.listSent).toHaveBeenCalledTimes(2);
});
