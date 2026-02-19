import { describe, expect, test, vi } from "vitest";
import {
  OrderProcessingError,
  OrderValidationError,
  submitOrder
} from "@/lib/order-service";
import type { Category } from "@/types/order";

const catalog: Category[] = [
  {
    name: "PASSOVER ESSENTIALS",
    products: [
      {
        id: "prod-1",
        category: "PASSOVER ESSENTIALS",
        name: "Ready Made Charoses",
        size: "250g",
        sortIndex: 0
      }
    ]
  }
];

const basePayload = {
  items: [{ productId: "prod-1", qty: 2 }],
  deliveryDate: "2026-03-26",
  deliverySlot: "AM" as const,
  customerName: "Sample Customer",
  phone: "020 7946 0958",
  addressLine1: "1 Test Street",
  postcode: "NW1 6XE"
};

describe("submitOrder", () => {
  test("returns success for valid order", async () => {
    const sendStoreOrderEmail = vi.fn().mockResolvedValue(undefined);
    const sendCustomerConfirmationEmail = vi.fn().mockResolvedValue(true);
    const appendOrderToSheet = vi.fn().mockResolvedValue(undefined);

    const result = await submitOrder(basePayload, "1.1.1.1", {
      getCatalog: () => catalog,
      sendStoreOrderEmail,
      sendCustomerConfirmationEmail,
      appendOrderToSheet
    });

    expect(result.ok).toBe(true);
    expect(result.orderRef).toMatch(/^KP-\d{8}-\d{4}$/);
    expect(sendStoreOrderEmail).toHaveBeenCalledTimes(1);
    expect(appendOrderToSheet).toHaveBeenCalledTimes(1);
    expect(sendCustomerConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  test("rejects unknown products", async () => {
    await expect(
      submitOrder(
        {
          ...basePayload,
          items: [{ productId: "missing-product", qty: 1 }]
        },
        "2.2.2.2",
        {
          getCatalog: () => catalog,
          sendStoreOrderEmail: vi.fn(),
          sendCustomerConfirmationEmail: vi.fn(),
          appendOrderToSheet: vi.fn()
        }
      )
    ).rejects.toBeInstanceOf(OrderValidationError);
  });

  test("surfaces processing failures", async () => {
    const sendStoreOrderEmail = vi.fn().mockRejectedValue(new Error("smtp down"));

    await expect(
      submitOrder(basePayload, "3.3.3.3", {
        getCatalog: () => catalog,
        sendStoreOrderEmail,
        sendCustomerConfirmationEmail: vi.fn(),
        appendOrderToSheet: vi.fn()
      })
    ).rejects.toBeInstanceOf(OrderProcessingError);
  });

  test("skips sheets append when SKIP_GOOGLE_SHEETS is enabled", async () => {
    const previousSkipSheets = process.env.SKIP_GOOGLE_SHEETS;
    process.env.SKIP_GOOGLE_SHEETS = "true";
    const sendStoreOrderEmail = vi.fn().mockResolvedValue(undefined);
    const sendCustomerConfirmationEmail = vi.fn().mockResolvedValue(true);
    const appendOrderToSheet = vi.fn().mockResolvedValue(undefined);

    try {
      const result = await submitOrder(basePayload, "4.4.4.4", {
        getCatalog: () => catalog,
        sendStoreOrderEmail,
        sendCustomerConfirmationEmail,
        appendOrderToSheet
      });

      expect(result.ok).toBe(true);
      expect(sendStoreOrderEmail).toHaveBeenCalledTimes(1);
      expect(appendOrderToSheet).toHaveBeenCalledTimes(0);
      expect(sendCustomerConfirmationEmail).toHaveBeenCalledTimes(1);
    } finally {
      if (previousSkipSheets === undefined) {
        delete process.env.SKIP_GOOGLE_SHEETS;
      } else {
        process.env.SKIP_GOOGLE_SHEETS = previousSkipSheets;
      }
    }
  });
});
