import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  OrderProcessingError,
  OrderRateLimitError,
  OrderValidationError
} from "@/lib/order-service";

const submitOrderMock = vi.fn();

vi.mock("@/lib/order-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/order-service")>(
    "@/lib/order-service"
  );
  return {
    ...actual,
    submitOrder: submitOrderMock
  };
});

describe("POST /api/orders", () => {
  beforeEach(() => {
    submitOrderMock.mockReset();
  });

  test("returns 400 on invalid JSON", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const req = new Request("http://localhost/api/orders", {
      method: "POST",
      body: "not-json",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("returns 200 on success", async () => {
    submitOrderMock.mockResolvedValue({
      ok: true,
      orderRef: "KP-20260328-1234",
      customerEmailSent: true
    });
    const { POST } = await import("@/app/api/orders/route");
    const req = new Request("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4"
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test("maps typed errors to status codes", async () => {
    const { POST } = await import("@/app/api/orders/route");

    submitOrderMock.mockRejectedValueOnce(new OrderValidationError("bad payload"));
    let response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" }
      })
    );
    expect(response.status).toBe(400);

    submitOrderMock.mockRejectedValueOnce(new OrderRateLimitError("too many", 9));
    response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" }
      })
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("9");

    submitOrderMock.mockRejectedValueOnce(new OrderProcessingError("smtp failed"));
    response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" }
      })
    );
    expect(response.status).toBe(502);
  });
});
