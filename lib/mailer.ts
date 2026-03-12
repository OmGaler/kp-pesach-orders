import nodemailer from "nodemailer";
import type { StoreConfig } from "@/config/store";
import { requireEnv } from "@/lib/env";
import type { NormalizedOrder } from "@/types/order";

function envTimeoutMs(name: string, fallbackMs: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallbackMs;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return parsed;
}

function makeTransporter() {
  const host = requireEnv("SMTP_HOST");
  const hostIp = process.env.SMTP_HOST_IP?.trim();
  const port = Number(requireEnv("SMTP_PORT"));
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
  const transportHost = hostIp || host;

  return nodemailer.createTransport({
    host: transportHost,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: envTimeoutMs("SMTP_CONNECTION_TIMEOUT_MS", 10000),
    greetingTimeout: envTimeoutMs("SMTP_GREETING_TIMEOUT_MS", 10000),
    socketTimeout: envTimeoutMs("SMTP_SOCKET_TIMEOUT_MS", 15000),
    dnsTimeout: envTimeoutMs("SMTP_DNS_TIMEOUT_MS", 8000),
    tls: hostIp ? { servername: host } : undefined
  });
}

export function parseRecipientList(raw: string): string[] {
  return raw
    .split(/[,\n;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function requireRecipients(name: string): string[] {
  const parsed = parseRecipientList(requireEnv(name));
  if (!parsed.length) {
    throw new Error(`Missing required recipient addresses in ${name}`);
  }
  return parsed;
}

function formatAddress(order: NormalizedOrder): string {
  return [order.addressLine1, order.addressLine2, order.postcode]
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
  const recipients = requireRecipients("ORDERS_EMAIL");
  const [primaryRecipient, ...bccRecipients] = recipients;
  if (!primaryRecipient) {
    throw new Error("Missing primary store recipient in ORDERS_EMAIL");
  }
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
    to: primaryRecipient,
    bcc: bccRecipients.length ? bccRecipients : undefined,
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
  const storeRecipients = requireRecipients("ORDERS_EMAIL");

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
    replyTo: storeRecipients[0]
  });

  return true;
}
