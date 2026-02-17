import nodemailer from "nodemailer";
import type { StoreConfig } from "@/config/store";
import { requireEnv } from "@/lib/env";
import type { NormalizedOrder } from "@/types/order";

function makeTransporter() {
  const host = requireEnv("SMTP_HOST");
  const port = Number(requireEnv("SMTP_PORT"));
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

function formatAddress(order: NormalizedOrder): string {
  return [
    order.addressLine1,
    order.addressLine2,
    order.city,
    order.postcode
  ]
    .filter(Boolean)
    .join(", ");
}

function formatItems(order: NormalizedOrder): string {
  return order.items
    .map((item) => `- ${item.name}${item.size ? ` (${item.size})` : ""} x ${item.qty}`)
    .join("\n");
}

export async function sendStoreOrderEmail(
  order: NormalizedOrder,
  storeConfig: StoreConfig
): Promise<void> {
  const from = requireEnv("SMTP_FROM");
  const to = requireEnv("ORDERS_EMAIL");
  const transporter = makeTransporter();
  const body = [
    `Order Ref: ${order.orderRef}`,
    `Placed: ${order.createdAtIso}`,
    "",
    `Delivery: ${order.deliveryDate} ${order.deliverySlot}`,
    "",
    "Customer:",
    `Name: ${order.customerName}`,
    `Phone: ${order.phone}`,
    `Email: ${order.email ?? "(not provided)"}`,
    `Address: ${formatAddress(order)}`,
    "",
    "Items:",
    formatItems(order),
    "",
    `Total item lines: ${order.items.length}`,
    `Notes: ${order.notes ?? "(none)"}`
  ].join("\n");

  await transporter.sendMail({
    from,
    to,
    subject: `${storeConfig.storeName} Pesach Order ${order.orderRef}`,
    text: body,
    replyTo: order.email || undefined
  });
}

export async function sendCustomerConfirmationEmail(
  order: NormalizedOrder,
  storeConfig: StoreConfig
): Promise<boolean> {
  if (!order.email) {
    return false;
  }
  const from = requireEnv("SMTP_FROM");
  const transporter = makeTransporter();

  const body = [
    `Thank you for your order with ${storeConfig.storeName}.`,
    "",
    `Order Ref: ${order.orderRef}`,
    `Requested delivery: ${order.deliveryDate} ${order.deliverySlot}`,
    "",
    "Items:",
    formatItems(order),
    "",
    `If anything needs changing, contact us at ${storeConfig.contactPhone} or ${storeConfig.contactEmail}.`
  ].join("\n");

  await transporter.sendMail({
    from,
    to: order.email,
    subject: `${storeConfig.storeName} order confirmation (${order.orderRef})`,
    text: body,
    replyTo: requireEnv("ORDERS_EMAIL")
  });

  return true;
}
