import { describe, expect, test } from "vitest";
import { isDateWithinWindow, validateOrderPayload } from "@/lib/validation";

describe("validation", () => {
  const minDate = "2026-03-22";
  const maxDate = "2026-04-03";

  test("accepts a valid order payload", () => {
    const payload = validateOrderPayload(
      {
        items: [{ productId: "abc", qty: 2 }],
        deliveryDate: "2026-03-28",
        deliverySlot: "AM",
        customerName: "Sample Customer",
        phone: "0200000000",
        addressLine1: "1 Test Street",
        email: "test@example.com"
      },
      minDate,
      maxDate
    );
    expect(payload.items).toHaveLength(1);
    expect(payload.deliverySlot).toBe("AM");
  });

  test("rejects date outside delivery window", () => {
    expect(() =>
      validateOrderPayload(
        {
          items: [{ productId: "abc", qty: 2 }],
          deliveryDate: "2026-04-20",
          deliverySlot: "AM",
          customerName: "Sample Customer",
          phone: "0200000000",
          addressLine1: "1 Test Street"
        },
        minDate,
        maxDate
      )
    ).toThrow();
  });

  test("validates date helper boundaries", () => {
    expect(isDateWithinWindow(minDate, minDate, maxDate)).toBe(true);
    expect(isDateWithinWindow(maxDate, minDate, maxDate)).toBe(true);
    expect(isDateWithinWindow("2026-03-01", minDate, maxDate)).toBe(false);
  });
});
