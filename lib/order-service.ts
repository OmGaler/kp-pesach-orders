import { randomInt } from "node:crypto";
import { storeConfig } from "@/config/store";
import { buildProductIndex, getCatalog } from "@/lib/catalog";
import { sendCustomerConfirmationEmail, sendStoreOrderEmail } from "@/lib/mailer";
import { checkRateLimit } from "@/lib/rate-limit";
import { appendOrderToSheet } from "@/lib/sheets";
import { validateOrderPayload } from "@/lib/validation";
import type { Category, NormalizedOrder } from "@/types/order";

export class OrderValidationError extends Error {}
export class OrderRateLimitError extends Error {
  retryAfterSec: number;

  constructor(message: string, retryAfterSec: number) {
    super(message);
    this.retryAfterSec = retryAfterSec;
  }
}
export class OrderProcessingError extends Error {}

interface SubmitDeps {
  getCatalog: () => Category[];
  sendStoreOrderEmail: typeof sendStoreOrderEmail;
  sendCustomerConfirmationEmail: typeof sendCustomerConfirmationEmail;
  appendOrderToSheet: typeof appendOrderToSheet;
}

const defaultDeps: SubmitDeps = {
  getCatalog,
  sendStoreOrderEmail,
  sendCustomerConfirmationEmail,
  appendOrderToSheet
};

function makeOrderReference(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const suffix = String(randomInt(0, 10_000)).padStart(4, "0");
  return `KP-${year}${month}${day}-${suffix}`;
}

export function makeClientKey(ip: string | null): string {
  return ip?.trim() || "unknown";
}

export interface SubmitResult {
  ok: true;
  orderRef: string;
  customerEmailSent: boolean;
}

export async function submitOrder(
  payload: unknown,
  clientIp: string | null,
  deps: SubmitDeps = defaultDeps
): Promise<SubmitResult> {
  const key = makeClientKey(clientIp);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    throw new OrderRateLimitError("Too many requests. Please retry shortly.", limit.retryAfterSec);
  }

  let orderInput;
  try {
    orderInput = validateOrderPayload(
      payload,
      storeConfig.deliveryWindowStart,
      storeConfig.deliveryWindowEnd
    );
  } catch (error) {
    throw new OrderValidationError(
      error instanceof Error ? error.message : "Order validation failed"
    );
  }

  const catalog = deps.getCatalog();
  const productIndex = buildProductIndex(catalog);
  const qtyByProduct = new Map<string, number>();
  for (const item of orderInput.items) {
    const current = qtyByProduct.get(item.productId) ?? 0;
    qtyByProduct.set(item.productId, current + item.qty);
  }

  const items = Array.from(qtyByProduct.entries()).map(([productId, qty]) => {
    const product = productIndex.get(productId);
    if (!product) {
      throw new OrderValidationError(`Unknown product selected: ${productId}`);
    }
    return {
      productId: product.id,
      name: product.name,
      size: product.size,
      qty
    };
  });

  const order: NormalizedOrder = {
    ...orderInput,
    items,
    orderRef: makeOrderReference(),
    createdAtIso: new Date().toISOString()
  };

  try {
    await deps.sendStoreOrderEmail(order, storeConfig);
    await deps.appendOrderToSheet(order);
    const customerEmailSent = await deps.sendCustomerConfirmationEmail(order, storeConfig);
    return {
      ok: true,
      orderRef: order.orderRef,
      customerEmailSent
    };
  } catch (error) {
    throw new OrderProcessingError(
      `Order processing failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
