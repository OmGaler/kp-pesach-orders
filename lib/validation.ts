import { z } from "zod";
import { isDeliveryDateAllowed, isFridayDeliveryDate } from "@/lib/delivery-rules";
import type { OrderPayload } from "@/types/order";

const ukPostcodeRegex =
  /^(GIR 0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]?\s?\d[ABD-HJLNP-UW-Z]{2})$/i;

const ukPhoneRegex =
  /^(?:(?:\+44\s?(?:\(0\)\s?)?)|0)(?:\d[\s()-]?){9,10}$/;

function wordCount(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

const normalizedString = ({
  label,
  min = 1,
  minMessage
}: {
  label: string;
  min?: number;
  minMessage?: string;
}) =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`
    })
    .transform((value) => value.trim())
    .pipe(z.string().min(min, minMessage ?? `${label} is required`));

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
    message: "Email must be a valid address"
  });

const ukPhone = normalizedString({
  label: "Phone",
  minMessage: "Phone is required"
}).refine((value) => ukPhoneRegex.test(value), {
  message: "Please enter a valid UK phone number"
});

const ukPostcode = normalizedString({
  label: "Postcode",
  min: 5,
  minMessage: "Postcode is required"
}).refine((value) => ukPostcodeRegex.test(value), {
  message: "Postcode must be a valid UK postcode"
});

function formatIssue(issue: z.ZodIssue): string {
  if (issue.path.length === 0) {
    return issue.message;
  }

  const path = issue.path
    .map((part) => String(part))
    .join(".")
    .replace(/\.\d+\./g, "[].");

  return `${path}: ${issue.message}`;
}

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
  return z
    .object({
      items: z
        .array(
          z.object({
            productId: normalizedString({
              label: "Product",
              minMessage: "Each selected item must include a product id"
            }),
            qty: z
              .number({
                required_error: "Quantity is required",
                invalid_type_error: "Quantity must be a number"
              })
              .int("Quantity must be a whole number")
              .min(1, "Quantity must be at least 1")
              .max(99, "Quantity cannot exceed 99")
          })
        )
        .min(1, "At least one item is required"),
      deliveryDate: normalizedString({
        label: "Delivery date",
        minMessage: "Delivery date is required"
      })
        .refine(
          (value) => isDateWithinWindow(value, minDateIso, maxDateIso),
          `Delivery date must be between ${minDateIso} and ${maxDateIso}`
        )
        .refine((value) => isDeliveryDateAllowed(value), "Delivery is unavailable on Saturdays"),
      deliverySlot: z.enum(["AM", "PM"]),
      allowKitniyot: z.boolean().optional().default(true),
      allowSubstitutes: z.boolean().optional().default(true),
      customerName: normalizedString({
        label: "Full name",
        min: 3,
        minMessage: "Full name is required"
      }).refine((value) => wordCount(value) >= 2, {
        message: "Full name must include at least first and last name"
      }),
      phone: ukPhone,
      addressLine1: normalizedString({
        label: "Address line 1",
        min: 3,
        minMessage: "Address line 1 is required"
      }),
      addressLine2: optionalNormalizedString,
      postcode: ukPostcode,
      email: optionalEmail,
      notes: optionalNormalizedString
    })
    .superRefine((value, context) => {
      if (isFridayDeliveryDate(value.deliveryDate) && value.deliverySlot === "PM") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deliverySlot"],
          message: "Friday deliveries are AM only"
        });
      }
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
    throw new Error(firstIssue ? formatIssue(firstIssue) : "Invalid order payload");
  }

  return parsed.data;
}
