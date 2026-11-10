import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DeliveryStatus } from "./DeliveryStatus";

afterEach(cleanup);
it("shows an animated pending icon with an explanation, not a sent label", () => {
  render(<DeliveryStatus event="queued" />);
  const status = screen.getByRole("img", {
    name: /Queued.*waiting to be sent/i,
  });
  expect(status.querySelector("svg")?.getAttribute("class")).toContain(
    "motion-safe:animate-spin",
  );
  expect(status.getAttribute("title")).toContain("Queued");
});
it("distinguishes sent from delivered and keeps failures accessible", () => {
  const { rerender } = render(<DeliveryStatus event="sent" />);
  expect(
    screen.getByRole("img", { name: /Sent.*not confirmed/i }),
  ).toBeTruthy();
  rerender(<DeliveryStatus event="delivered" />);
  expect(
    screen.getByRole("img", { name: /Delivered.*recipient.*server/i }),
  ).toBeTruthy();
  rerender(<DeliveryStatus event="bounced" />);
  expect(screen.getByRole("img", { name: /Bounced.*rejected/i })).toBeTruthy();
});
it("does not invent successful delivery for unknown states", () => {
  render(<DeliveryStatus event="new_provider_status" />);
  expect(
    screen.getByRole("img", { name: /Unknown.*new_provider_status/i }),
  ).toBeTruthy();
});
