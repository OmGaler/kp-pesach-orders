import { NextResponse } from "next/server";
import {
  OrderProcessingError,
  OrderRateLimitError,
  OrderValidationError,
  submitOrder
} from "@/lib/order-service";

export const runtime = "nodejs";

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const result = await submitOrder(payload, getClientIp(request));
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    if (error instanceof OrderRateLimitError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        {
          status: 429,
          headers: {
            "Retry-After": String(error.retryAfterSec)
          }
        }
      );
    }
    if (error instanceof OrderProcessingError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    return NextResponse.json({ ok: false, error: "Unexpected server error" }, { status: 500 });
  }
}
