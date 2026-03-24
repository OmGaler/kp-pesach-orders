import { describe, expect, test } from "vitest";
import { selectDashboardSheet } from "@/lib/sheets";

describe("selectDashboardSheet", () => {
  test("prefers the configured dashboard tab when present", () => {
    const dashboard = selectDashboardSheet(
      [
        { sheetId: 1, title: "Contents" },
        { sheetId: 2, title: "Orders overview" }
      ],
      "Orders overview"
    );

    expect(dashboard?.title).toBe("Orders overview");
  });

  test("finds an orders tab when it is the dashboard", () => {
    const dashboard = selectDashboardSheet(
      [
        { sheetId: 11, title: "Orders" },
        { sheetId: 12, title: "Order KP-20260322-0001" }
      ],
      ""
    );

    expect(dashboard?.title).toBe("Orders");
  });

  test("finds a contents tab when Sheet1 has been renamed", () => {
    const dashboard = selectDashboardSheet(
      [
        { sheetId: 11, title: "Contents" },
        { sheetId: 12, title: "Order KP-20260322-0001" }
      ],
      ""
    );

    expect(dashboard?.title).toBe("Contents");
  });

  test("avoids treating an order detail tab as the dashboard fallback", () => {
    const dashboard = selectDashboardSheet(
      [
        { sheetId: 21, title: "Order KP-20260322-0001" },
        { sheetId: 22, title: "Main" },
        { sheetId: 23, title: "Order KP-20260322-0002" }
      ],
      ""
    );

    expect(dashboard?.title).toBe("Main");
  });
});
