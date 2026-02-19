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
        phone: "020 7946 0958",
        addressLine1: "1 Test Street",
        postcode: "SW1A 1AA",
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
          phone: "020 7946 0958",
          addressLine1: "1 Test Street",
          postcode: "SW1A 1AA"
        },
        minDate,
        maxDate
      )
    ).toThrow(`deliveryDate: Delivery date must be between ${minDate} and ${maxDate}`);
  });

  test("rejects invalid UK phone number", () => {
    expect(() =>
      validateOrderPayload(
        {
          items: [{ productId: "abc", qty: 2 }],
          deliveryDate: "2026-03-28",
          deliverySlot: "AM",
          customerName: "Sample Customer",
          phone: "555-1234",
          addressLine1: "1 Test Street",
          postcode: "SW1A 1AA"
        },
        minDate,
        maxDate
      )
    ).toThrow("phone: Please enter a valid UK phone number");
  });

  test("rejects invalid UK postcode", () => {
    expect(() =>
      validateOrderPayload(
        {
          items: [{ productId: "abc", qty: 2 }],
          deliveryDate: "2026-03-28",
          deliverySlot: "AM",
          customerName: "Sample Customer",
          phone: "020 7946 0958",
          addressLine1: "1 Test Street",
          postcode: "12345"
        },
        minDate,
        maxDate
      )
    ).toThrow("postcode: Postcode must be a valid UK postcode");
  });

  test("rejects invalid optional email", () => {
    expect(() =>
      validateOrderPayload(
        {
          items: [{ productId: "abc", qty: 2 }],
          deliveryDate: "2026-03-28",
          deliverySlot: "AM",
          customerName: "Sample Customer",
          phone: "020 7946 0958",
          addressLine1: "1 Test Street",
          postcode: "SW1A 1AA",
          email: "not-an-email"
        },
        minDate,
        maxDate
      )
    ).toThrow("email: Email must be a valid address");
  });

  test("rejects single-word names", () => {
    expect(() =>
      validateOrderPayload(
        {
          items: [{ productId: "abc", qty: 2 }],
          deliveryDate: "2026-03-28",
          deliverySlot: "AM",
          customerName: "Sample",
          phone: "020 7946 0958",
          addressLine1: "1 Test Street",
          postcode: "SW1A 1AA"
        },
        minDate,
        maxDate
      )
    ).toThrow("customerName: Full name must include at least first and last name");
  });

  test("keeps address line 2 optional", () => {
    const payload = validateOrderPayload(
      {
        items: [{ productId: "abc", qty: 2 }],
        deliveryDate: "2026-03-28",
        deliverySlot: "AM",
        customerName: "Sample Customer",
        phone: "020 7946 0958",
        addressLine1: "1 Test Street",
        addressLine2: "   ",
        postcode: "SW1A 1AA"
      },
      minDate,
      maxDate
    );

    expect(payload.addressLine2).toBeUndefined();
  });

  test("validates date helper boundaries", () => {
    expect(isDateWithinWindow(minDate, minDate, maxDate)).toBe(true);
    expect(isDateWithinWindow(maxDate, minDate, maxDate)).toBe(true);
    expect(isDateWithinWindow("2026-03-01", minDate, maxDate)).toBe(false);
  });
});
