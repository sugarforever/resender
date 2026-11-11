import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComposeView } from "./ComposeView";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { sendEmail: vi.fn() },
  errMessage: (e: unknown) => String(e),
}));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

it("identifies invalid copied recipients inline and keeps the message", async () => {
  localStorage.setItem("resender.defaultFrom", "alex@northstar.example");
  const user = userEvent.setup();
  render(<ComposeView onSent={vi.fn()} />);
  await user.type(
    screen.getByLabelText("To", { exact: true }),
    "maya@studio.example",
  );
  await user.type(screen.getByLabelText("Subject"), "Launch");
  await user.type(screen.getByLabelText("Message"), "Keep my message");
  await user.click(screen.getByRole("button", { name: "Cc / Bcc" }));
  await user.type(screen.getByLabelText("Cc", { exact: true }), "invalid");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(
    screen.getByLabelText("Cc", { exact: true }).getAttribute("aria-invalid"),
  ).toBe("true");
  expect(screen.getByRole("alert").textContent).toContain("valid address");
  expect(screen.getByLabelText("Message")).toHaveProperty(
    "value",
    "Keep my message",
  );
  expect(api.sendEmail).not.toHaveBeenCalled();
});

it("sends with Ctrl+Enter and retains every field after a network failure", async () => {
  localStorage.setItem("resender.defaultFrom", "alex@northstar.example");
  vi.mocked(api.sendEmail).mockRejectedValue(new Error("Offline"));
  const user = userEvent.setup();
  render(<ComposeView onSent={vi.fn()} />);
  await user.type(
    screen.getByLabelText("To", { exact: true }),
    "maya@studio.example",
  );
  await user.type(screen.getByLabelText("Subject"), "Launch");
  await user.type(screen.getByLabelText("Message"), "Ready for Thursday");
  await user.keyboard("{Control>}{Enter}{/Control}");
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Offline"),
  );
  expect(screen.getByLabelText("To", { exact: true })).toHaveProperty(
    "value",
    "maya@studio.example",
  );
  expect(screen.getByLabelText("Subject")).toHaveProperty("value", "Launch");
  expect(screen.getByLabelText("Message")).toHaveProperty(
    "value",
    "Ready for Thursday",
  );
});
