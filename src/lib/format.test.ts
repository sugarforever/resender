import { expect, it } from "vitest";
import { parseAddressList } from "./format";

it("keeps commas in quoted Reply-To display names while splitting recipients", () => {
  expect(
    parseAddressList(
      '"Support, Team" <support@example.com>, Person <person@example.com>; other@example.com',
    ),
  ).toEqual([
    '"Support, Team" <support@example.com>',
    "Person <person@example.com>",
    "other@example.com",
  ]);
});
