import { describe, expect, test } from "vitest";
import { isDateWithinWindow, validateOrderPayload } from "@/lib/validation";

describe("validation", () => {
  const minDate = "2026-03-24";
  const maxDate = "2026-04-07";
  const validDate = "2026-03-26";
  const nowBeforeDeadlines = new Date("2026-03-26T12:00:00+00:00");

  const basePayload = {
    items: [{ productId: "abc", qty: 2 }],
    deliveryDate: validDate,
    deliverySlot: "AM" as const,
    customerName: "Sample Customer",
    phone: "020 7946 0958",
    addressLine1: "1 Test Street",
    postcode: "SW1A 1AA"
  };

  function validate(payload: unknown, now: Date = nowBeforeDeadlines) {
    return validateOrderPayload(payload, minDate, maxDate, now);
  }

  test("accepts a valid order payload", () => {
    const payload = validate({
      ...basePayload,
      email: "test@example.com"
    });
    expect(payload.items).toHaveLength(1);
    expect(payload.deliverySlot).toBe("AM");
  });

  test("rejects date outside delivery window", () => {
    expect(() =>
      validate({
        ...basePayload,
        deliveryDate: "2026-04-20"
      })
    ).toThrow(`deliveryDate: Delivery date must be between ${minDate} and ${maxDate}`);
  });

  test("rejects invalid UK phone number", () => {
    expect(() =>
      validate({
        ...basePayload,
        phone: "555-1234"
      })
    ).toThrow("phone: Please enter a valid UK phone number");
  });

  test("rejects invalid UK postcode", () => {
    expect(() =>
      validate({
        ...basePayload,
        postcode: "12345"
      })
    ).toThrow("postcode: Postcode must be a valid UK postcode");
  });

  test("rejects invalid optional email", () => {
    expect(() =>
      validate({
        ...basePayload,
        email: "not-an-email"
      })
    ).toThrow("email: Email must be a valid address");
  });

  test("rejects single-word names", () => {
    expect(() =>
      validate({
        ...basePayload,
        customerName: "Sample"
      })
    ).toThrow("customerName: Full name must include at least first and last name");
  });

  test("keeps address line 2 optional", () => {
    const payload = validate({
      ...basePayload,
      addressLine2: "   "
    });

    expect(payload.addressLine2).toBeUndefined();
  });

  test("rejects Saturday deliveries", () => {
    expect(() =>
      validate({
        ...basePayload,
        deliveryDate: "2026-03-28"
      })
    ).toThrow("deliveryDate: Delivery is unavailable for selected date");
  });

  test("rejects Friday PM deliveries", () => {
    expect(() =>
      validate({
        ...basePayload,
        deliveryDate: "2026-03-27",
        deliverySlot: "PM"
      })
    ).toThrow("deliverySlot: Selected delivery slot is unavailable for this date");
  });

  test("accepts Friday AM deliveries", () => {
    const payload = validate({
      ...basePayload,
      deliveryDate: "2026-03-27"
    });

    expect(payload.deliverySlot).toBe("AM");
  });

  test("rejects 1 April PM deliveries", () => {
    expect(() =>
      validate({
        ...basePayload,
        deliveryDate: "2026-04-01",
        deliverySlot: "PM"
      })
    ).toThrow("deliverySlot: Selected delivery slot is unavailable for this date");
  });

  test("allows 5 and 6 April deliveries", () => {
    const payload5 = validate({
      ...basePayload,
      deliveryDate: "2026-04-05",
      deliverySlot: "PM"
    });
    const payload6 = validate({
      ...basePayload,
      deliveryDate: "2026-04-06",
      deliverySlot: "PM"
    });

    expect(payload5.deliveryDate).toBe("2026-04-05");
    expect(payload6.deliveryDate).toBe("2026-04-06");
  });

  test("rejects blocked gap dates even when inside min/max window", () => {
    expect(() =>
      validate({
        ...basePayload,
        deliveryDate: "2026-04-02"
      })
    ).toThrow("deliveryDate: Delivery is unavailable for selected date");
  });

  test("accepts 7 April AM and rejects 7 April PM", () => {
    const allowed = validate({
      ...basePayload,
      deliveryDate: "2026-04-07",
      deliverySlot: "AM"
    });

    expect(allowed.deliverySlot).toBe("AM");

    expect(() =>
      validate({
        ...basePayload,
        deliveryDate: "2026-04-07",
        deliverySlot: "PM"
      })
    ).toThrow("deliverySlot: Selected delivery slot is unavailable for this date");
  });

  test("locks first chag dates after 29 March 23:59 cutoff", () => {
    expect(() =>
      validate(
        {
          ...basePayload,
          deliveryDate: "2026-03-31",
          deliverySlot: "AM"
        },
        new Date("2026-03-30T00:01:00+01:00")
      )
    ).toThrow("deliveryDate: Ordering deadline has passed for selected delivery date");
  });

  test("keeps second chag dates open after first cutoff", () => {
    const payload = validate(
      {
        ...basePayload,
        deliveryDate: "2026-04-06",
        deliverySlot: "PM"
      },
      new Date("2026-03-30T12:00:00+01:00")
    );

    expect(payload.deliveryDate).toBe("2026-04-06");
  });

  test("locks second chag dates after 5 April 23:59 cutoff", () => {
    expect(() =>
      validate(
        {
          ...basePayload,
          deliveryDate: "2026-04-06",
          deliverySlot: "AM"
        },
        new Date("2026-04-06T00:01:00+01:00")
      )
    ).toThrow("deliveryDate: Ordering deadline has passed for selected delivery date");
  });

  test("validates date helper boundaries", () => {
    expect(isDateWithinWindow(minDate, minDate, maxDate)).toBe(true);
    expect(isDateWithinWindow(maxDate, minDate, maxDate)).toBe(true);
    expect(isDateWithinWindow("2026-03-01", minDate, maxDate)).toBe(false);
  });
});
