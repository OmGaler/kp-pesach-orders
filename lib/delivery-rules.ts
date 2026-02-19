import type { DeliverySlot } from "@/types/order";

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatIsoDate(value: Date): string {
  const year = String(value.getUTCFullYear());
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function weekdayFromIsoDate(value: string): number | null {
  const date = parseIsoDate(value);
  return date ? date.getUTCDay() : null;
}

export function isFridayDeliveryDate(value: string): boolean {
  return weekdayFromIsoDate(value) === 5;
}

export function isSaturdayDeliveryDate(value: string): boolean {
  return weekdayFromIsoDate(value) === 6;
}

export function isDeliveryDateAllowed(value: string): boolean {
  const weekday = weekdayFromIsoDate(value);
  return weekday !== null && weekday !== 6;
}

export function isDeliverySlotAllowed(deliveryDate: string, deliverySlot: DeliverySlot): boolean {
  if (!isDeliveryDateAllowed(deliveryDate)) {
    return false;
  }
  if (isFridayDeliveryDate(deliveryDate)) {
    return deliverySlot === "AM";
  }
  return deliverySlot === "AM" || deliverySlot === "PM";
}

export function firstAllowedDeliveryDateInWindow(minDateIso: string, maxDateIso: string): string {
  const minDate = parseIsoDate(minDateIso);
  const maxDate = parseIsoDate(maxDateIso);
  if (!minDate || !maxDate || minDate > maxDate) {
    return minDateIso;
  }

  let cursor = minDate;
  while (cursor <= maxDate) {
    const iso = formatIsoDate(cursor);
    if (isDeliveryDateAllowed(iso)) {
      return iso;
    }
    cursor = addUtcDays(cursor, 1);
  }

  return minDateIso;
}
