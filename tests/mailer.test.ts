import { describe, expect, test } from "vitest";
import { parseRecipientList } from "@/lib/mailer";

describe("mailer recipient parsing", () => {
  test("filters empty recipient entries", () => {
    expect(parseRecipientList("orders@kosherparadise.co.uk,, admin@omergaler.com")).toEqual([
      "orders@kosherparadise.co.uk",
      "admin@omergaler.com"
    ]);
  });

  test("supports comma, semicolon, and newline separators", () => {
    expect(
      parseRecipientList("orders@kosherparadise.co.uk; admin@omergaler.com\nthird@example.com")
    ).toEqual(["orders@kosherparadise.co.uk", "admin@omergaler.com", "third@example.com"]);
  });
});
