import { google } from "googleapis";
import { requireEnv } from "@/lib/env";
import type { NormalizedOrder } from "@/types/order";

export async function appendOrderToSheet(order: NormalizedOrder): Promise<void> {
  const serviceEmail = requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const rawPrivateKey = requireEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  const spreadsheetId = requireEnv("GOOGLE_SHEET_ID");
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({
    version: "v4",
    auth
  });

  const itemSummary = order.items
    .map((item) => `${item.name}${item.size ? ` (${item.size})` : ""} x${item.qty}`)
    .join("; ");

  const address = [order.addressLine1, order.addressLine2, order.postcode].filter(Boolean).join(", ");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Orders!A:K",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          order.createdAtIso,
          order.orderRef,
          order.deliveryDate,
          order.deliverySlot,
          order.customerName,
          order.phone,
          address,
          order.email ?? "",
          order.notes ?? "",
          String(order.items.length),
          itemSummary
        ]
      ]
    }
  });
}
