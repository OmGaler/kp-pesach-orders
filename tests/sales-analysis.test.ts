import { describe, expect, test } from "vitest";
import { parseCatalogRows } from "@/lib/catalog";

const {
  buildSalesAnalysis,
  buildCategoryLookup,
  calculateUnfulfilledDemand,
  inferProductType,
  isUnfulfilledStatus,
  isOrderDetailSheetTitle,
  parseOrderSheetValues
} = require("../lib/sales-analysis");

describe("isOrderDetailSheetTitle", () => {
  test("matches order detail tabs", () => {
    expect(isOrderDetailSheetTitle("Order KP-20260322-0001")).toBe(true);
  });

  test("ignores non-order tabs", () => {
    expect(isOrderDetailSheetTitle("Orders")).toBe(false);
    expect(isOrderDetailSheetTitle("Contents")).toBe(false);
  });
});

describe("parseOrderSheetValues", () => {
  test("parses summary fields and item rows", () => {
    const parsed = parseOrderSheetValues("Order KP-20260322-0001", [
      ["Order Summary", ""],
      ["Order ID", "KP-20260322-0001"],
      ["Created At", "2026-03-22 10:11:12"],
      ["Customer Name", "Leah Cohen"],
      ["Delivery Date", "2026-04-01"],
      ["Delivery Slot", "Morning"],
      ["Phone", "01234"],
      ["Notes", "Leave by the back door"],
      [],
      ["Item #", "Item Name", "Size", "Quantity"],
      ["1", "Matzah Meal", "500g", "2"],
      ["2", "Potato Starch", "", "1"]
    ]);

    expect(parsed.orderId).toBe("KP-20260322-0001");
    expect(parsed.customerName).toBe("Leah Cohen");
    expect(parsed.deliveryDate).toBe("2026-04-01");
    expect(parsed.items).toEqual([
      { name: "Matzah Meal", size: "500g", quantity: 2 },
      { name: "Potato Starch", size: "", quantity: 1 }
    ]);
  });
});

describe("inferProductType", () => {
  test("falls back to useful heuristics when no subcategory is present", () => {
    expect(inferProductType("French's Yellow Mustard")).toBe("Mustard");
    expect(inferProductType("Kedem Grape Juice")).toBe("Grape Juice");
  });
});

describe("isUnfulfilledStatus", () => {
  test("only keeps statuses that still need stock", () => {
    expect(isUnfulfilledStatus("Not started")).toBe(true);
    expect(isUnfulfilledStatus("Picking")).toBe(true);
    expect(isUnfulfilledStatus("Order ready")).toBe(false);
    expect(isUnfulfilledStatus("Delivered")).toBe(false);
    expect(isUnfulfilledStatus("Cancelled")).toBe(false);
  });
});

describe("buildSalesAnalysis", () => {
  test("aggregates by category, subcategory, product type and size mix", () => {
    const categoryLookup = buildCategoryLookup(
      parseCatalogRows(
        [
          ["Product", "Size"],
          ["FISH", ""],
          ["Smoked Salmon", ""],
          ["Brand A Smoked Salmon", "100g"],
          ["Brand B Smoked Salmon", "200g"],
          ["CONDIMENTS", ""],
          ["French's Yellow Mustard", "500g"],
          ["Heinz Mustard", "250g"]
        ],
        { subheadingRowIndexes: new Set([2]) }
      )
    );

    const analysis = buildSalesAnalysis(
      [
        {
          orderId: "KP-1",
          createdAt: "2026-03-20 08:00:00",
          customerName: "Leah Cohen",
          deliveryDate: "2026-04-01",
          deliverySlot: "Morning",
          status: "Delivered",
          items: [
            { name: "Brand A Smoked Salmon", size: "100g", quantity: 2 },
            { name: "French's Yellow Mustard", size: "500g", quantity: 1 }
          ]
        },
        {
          orderId: "KP-2",
          createdAt: "2026-03-20 09:00:00",
          customerName: "David Cohen",
          deliveryDate: "2026-04-02",
          deliverySlot: "Afternoon",
          status: "Picking",
          items: [
            { name: "Brand B Smoked Salmon", size: "200g", quantity: 3 },
            { name: "Heinz Mustard", size: "250g", quantity: 2 }
          ]
        }
      ],
      categoryLookup
    );

    expect(analysis.summary).toEqual({
      orderCount: 2,
      totalQuantity: 8,
      uniqueProducts: 4,
      uniqueProductTypes: 2,
      matchedProducts: 4,
      unmatchedProducts: 0
    });

    expect(analysis.categoryTotals).toEqual([
      {
        category: "FISH",
        totalQuantity: 5,
        orderCount: 2,
        productCount: 2,
        quantityPct: 62.5
      },
      {
        category: "CONDIMENTS",
        totalQuantity: 3,
        orderCount: 2,
        productCount: 2,
        quantityPct: 37.5
      }
    ]);

    expect(analysis.subcategoryTotals).toEqual([
      {
        category: "FISH",
        subcategory: "Smoked Salmon",
        totalQuantity: 5,
        orderCount: 2,
        productCount: 2,
        quantityPct: 62.5,
        categoryQuantityPct: 100
      },
      {
        category: "CONDIMENTS",
        subcategory: "Mustard",
        totalQuantity: 3,
        orderCount: 2,
        productCount: 2,
        quantityPct: 37.5,
        categoryQuantityPct: 100
      }
    ]);

    expect(analysis.productTypeTotals).toEqual([
      {
        category: "FISH",
        subcategory: "Smoked Salmon",
        productType: "Smoked Salmon",
        totalQuantity: 5,
        orderCount: 2,
        productCount: 2,
        quantityPct: 62.5,
        subcategoryQuantityPct: 100
      },
      {
        category: "CONDIMENTS",
        subcategory: "Mustard",
        productType: "Mustard",
        totalQuantity: 3,
        orderCount: 2,
        productCount: 2,
        quantityPct: 37.5,
        subcategoryQuantityPct: 100
      }
    ]);

    expect(analysis.productTypeSizeMix).toEqual([
      {
        category: "CONDIMENTS",
        subcategory: "Mustard",
        productType: "Mustard",
        size: "250g",
        totalQuantity: 2,
        quantityPctWithinProductType: 66.67
      },
      {
        category: "CONDIMENTS",
        subcategory: "Mustard",
        productType: "Mustard",
        size: "500g",
        totalQuantity: 1,
        quantityPctWithinProductType: 33.33
      },
      {
        category: "FISH",
        subcategory: "Smoked Salmon",
        productType: "Smoked Salmon",
        size: "200g",
        totalQuantity: 3,
        quantityPctWithinProductType: 60
      },
      {
        category: "FISH",
        subcategory: "Smoked Salmon",
        productType: "Smoked Salmon",
        size: "100g",
        totalQuantity: 2,
        quantityPctWithinProductType: 40
      }
    ]);

    expect(analysis.deliveryDateTotals).toEqual([
      {
        deliveryDate: "2026-04-01",
        orderCount: 1,
        totalQuantity: 3,
        quantityPct: 37.5
      },
      {
        deliveryDate: "2026-04-02",
        orderCount: 1,
        totalQuantity: 5,
        quantityPct: 62.5
      }
    ]);

    expect(analysis.unfulfilledProductTotals).toEqual([
      {
        name: "Brand B Smoked Salmon",
        category: "FISH",
        subcategory: "Smoked Salmon",
        productType: "Smoked Salmon",
        totalQuantity: 3,
        orderCount: 1,
        quantityPct: 60
      },
      {
        name: "Heinz Mustard",
        category: "CONDIMENTS",
        subcategory: "Mustard",
        productType: "Mustard",
        totalQuantity: 2,
        orderCount: 1,
        quantityPct: 40
      }
    ]);
  });

  test("collapses wine and chocolate brand sections into broader categories", () => {
    const analysis = buildSalesAnalysis(
      [
        {
          orderId: "KP-3",
          createdAt: "2026-03-20 10:00:00",
          customerName: "Sarah",
          deliveryDate: "2026-04-03",
          deliverySlot: "Morning",
          status: "Picking",
          items: [
            { name: "Merlot", size: "750ml", quantity: 2 },
            { name: "Swiss Milk Chocolate Bar", size: "100g", quantity: 3 }
          ]
        }
      ],
      new Map([
        [
          "merlot|||750ml",
          { category: "YARDEN - ISRAEL", subcategory: null, productType: "Merlot" }
        ],
        [
          "swiss milk chocolate bar|||100g",
          { category: "ALPROSE", subcategory: null, productType: "Swiss Milk Chocolate Bar" }
        ]
      ])
    );

    expect(analysis.categoryTotals).toEqual([
      {
        category: "CHOCOLATES",
        totalQuantity: 3,
        orderCount: 1,
        productCount: 1,
        quantityPct: 60
      },
      {
        category: "WINES",
        totalQuantity: 2,
        orderCount: 1,
        productCount: 1,
        quantityPct: 40
      }
    ]);

    expect(analysis.productTypeTotals).toEqual([
      {
        category: "CHOCOLATES",
        subcategory: "Alprose",
        productType: "Chocolate",
        totalQuantity: 3,
        orderCount: 1,
        productCount: 1,
        quantityPct: 60,
        subcategoryQuantityPct: 100
      },
      {
        category: "WINES",
        subcategory: "Yarden - Israel",
        productType: "Wine",
        totalQuantity: 2,
        orderCount: 1,
        productCount: 1,
        quantityPct: 40,
        subcategoryQuantityPct: 100
      }
    ]);
  });

  test("calculates unfulfilled demand for a queried product", () => {
    const demand = calculateUnfulfilledDemand(
      [
        {
          orderId: "KP-10",
          createdAt: "2026-03-20 10:00:00",
          customerName: "Sarah",
          deliveryDate: "2026-04-03",
          deliverySlot: "Morning",
          status: "Not started",
          items: [
            { name: "Rowse Clear Honey", size: "340g", quantity: 2 },
            { name: "Organic Honey", size: "500g", quantity: 1 }
          ]
        },
        {
          orderId: "KP-11",
          createdAt: "2026-03-20 11:00:00",
          customerName: "David",
          deliveryDate: "2026-04-04",
          deliverySlot: "Afternoon",
          status: "Order ready",
          items: [{ name: "Honey", size: "250g", quantity: 4 }]
        },
        {
          orderId: "KP-12",
          createdAt: "2026-03-20 12:00:00",
          customerName: "Leah",
          deliveryDate: "2026-04-05",
          deliverySlot: "Afternoon",
          status: "Picking",
          items: [{ name: "Wildflower Honey", size: "250g", quantity: 3 }]
        },
        {
          orderId: "KP-13",
          createdAt: "2026-03-20 13:00:00",
          customerName: "Rivka",
          deliveryDate: "2026-04-06",
          deliverySlot: "Morning",
          status: "Cancelled",
          items: [{ name: "Honey", size: "250g", quantity: 9 }]
        }
      ],
      "honey"
    );

    expect(demand.totalQuantity).toBe(6);
    expect(demand.matchingOrders).toBe(2);
    expect(demand.matches).toEqual([
      {
        name: "Wildflower Honey",
        category: "Unmatched",
        subcategory: "Wildflower Honey",
        productType: "Wildflower Honey",
        totalQuantity: 3,
        orderCount: 1
      },
      {
        name: "Rowse Clear Honey",
        category: "Unmatched",
        subcategory: "Rowse Clear Honey",
        productType: "Rowse Clear Honey",
        totalQuantity: 2,
        orderCount: 1
      },
      {
        name: "Organic Honey",
        category: "Unmatched",
        subcategory: "Organic Honey",
        productType: "Organic Honey",
        totalQuantity: 1,
        orderCount: 1
      }
    ]);
    expect(demand.orderLines).toHaveLength(3);
    expect(demand.orderLines.every((line) => line.status !== "Order ready")).toBe(true);
    expect(demand.orderLines.every((line) => line.status !== "Cancelled")).toBe(true);
  });
});
