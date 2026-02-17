import { z } from "zod";
import type { OrderPayload } from "@/types/order";

const normalizedString = (min = 1) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(min));

const optionalNormalizedString = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  });

const optionalEmail = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  })
  .refine((value) => value === undefined || z.string().email().safeParse(value).success, {
    message: "Invalid email address"
  });

export function isDateWithinWindow(
  value: string,
  minDateIso: string,
  maxDateIso: string
): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  const min = new Date(`${minDateIso}T00:00:00Z`);
  const max = new Date(`${maxDateIso}T00:00:00Z`);

  if (Number.isNaN(date.getTime()) || Number.isNaN(min.getTime()) || Number.isNaN(max.getTime())) {
    return false;
  }
  return date >= min && date <= max;
}

export function makeOrderSchema(minDateIso: string, maxDateIso: string) {
  return z.object({
    items: z
      .array(
        z.object({
          productId: normalizedString(1),
          qty: z.number().int().min(1).max(99)
        })
      )
      .min(1, "At least one item is required"),
    deliveryDate: normalizedString(1).refine(
      (value) => isDateWithinWindow(value, minDateIso, maxDateIso),
      `Delivery date must be between ${minDateIso} and ${maxDateIso}`
    ),
    deliverySlot: z.enum(["AM", "PM"]),
    customerName: normalizedString(2),
    phone: normalizedString(5),
    addressLine1: normalizedString(3),
    addressLine2: optionalNormalizedString,
    city: optionalNormalizedString,
    postcode: optionalNormalizedString,
    email: optionalEmail,
    notes: optionalNormalizedString
  });
}

export function validateOrderPayload(
  payload: unknown,
  minDateIso: string,
  maxDateIso: string
): OrderPayload {
  const schema = makeOrderSchema(minDateIso, maxDateIso);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new Error(firstIssue?.message ?? "Invalid order payload");
  }

  return parsed.data;
}
