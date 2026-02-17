import type { DeliverySlot } from "@/types/order";

export const deliverySlots: DeliverySlot[] = ["AM", "PM"];

export interface StoreConfig {
  storeName: string;
  ordersEmail: string;
  contactPhone: string;
  contactEmail: string;
  openingTimes: string[];
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  deliverySlots: DeliverySlot[];
}

export const storeConfig: StoreConfig = {
  storeName: "Kosher Paradise",
  ordersEmail: process.env.ORDERS_EMAIL ?? "orders@example.com",
  contactPhone: "0208 455 2454",
  contactEmail: "orders@kosherparadise.co.uk",
  openingTimes: [
    "Sun-Thu: 08:00-20:00",
    "Fri: 08:00-14:00",
    "Motzai Shabbos: 20:30-23:00"
  ],
  deliveryWindowStart: "2026-03-22",
  deliveryWindowEnd: "2026-04-03",
  deliverySlots
};
