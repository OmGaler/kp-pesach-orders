import type { DeliverySlot } from "@/types/order";

const CORE_WINDOW_START = "2026-03-24";
const CORE_WINDOW_END = "2026-04-01";
const EXTRA_ALLOWED_DATES = new Set(["2026-04-05", "2026-04-06", "2026-04-07"]);
const AM_ONLY_DATES = new Set(["2026-04-01", "2026-04-07"]);

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

function isIsoDateWithinRange(value: string, startIso: string, endIso: string): boolean {
  const date = parseIsoDate(value);
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!date || !start || !end) {
    return false;
  }
  return date >= start && date <= end;
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
  if (isSaturdayDeliveryDate(value)) {
    return false;
  }
  if (isIsoDateWithinRange(value, CORE_WINDOW_START, CORE_WINDOW_END)) {
    return true;
  }
  return EXTRA_ALLOWED_DATES.has(value);
}

export function isDeliverySlotAllowed(deliveryDate: string, deliverySlot: DeliverySlot): boolean {
  if (!isDeliveryDateAllowed(deliveryDate)) {
    return false;
  }
  if (isFridayDeliveryDate(deliveryDate) || AM_ONLY_DATES.has(deliveryDate)) {
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
