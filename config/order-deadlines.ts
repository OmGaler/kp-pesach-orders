export interface OrderDeadlineRule {
  id: string;
  deliveryDateRange?: {
    startIso: string;
    endIso: string;
  };
  deliveryDates?: readonly string[];
  cutoffIso: string;
  cutoffLabel: string;
  announcement: string;
}

// Set this to an ISO datetime (for example: "2026-04-06T00:10:00+01:00")
// to preview the locked-state UI without changing your system clock.
export const ORDER_DEADLINE_TEST_NOW_ISO: string | null = null; //"2026-04-04T00:10:00+01:00";

export const ORDER_DEADLINE_RULES: readonly OrderDeadlineRule[] = [
  {
    id: "first-chag",
    deliveryDateRange: {
      startIso: "2026-03-24",
      endIso: "2026-04-01"
    },
    cutoffIso: "2026-03-29T23:59:59+01:00",
    cutoffLabel: "Sun 29 Mar, 11:59PM",
    announcement:
      "First Chag deliveries (up to 1st April) close on "
  },
  {
    id: "second-chag",
    deliveryDates: ["2026-04-05", "2026-04-06", "2026-04-07"],
    cutoffIso: "2026-04-05T23:59:59+01:00",
    cutoffLabel: "Sun 5 Apr, 11:59PM",
    announcement:
      "Second Chag deliveries (5th, 6th or 7th April) close on "
  }
];
