import type { DeliverySlot } from "@/types/order";

export const deliverySlots: DeliverySlot[] = ["AM", "PM"];

export interface StoreConfig {
  storeName: string;
  ordersEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
  contactEmail: string;
  contactAddress: string;
  openingTimes: string[];
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  deliverySlots: DeliverySlot[];
}

export const storeConfig: StoreConfig = {
  storeName: "Kosher Paradise",
  ordersEmail: process.env.ORDERS_EMAIL ?? "",
  contactPhone: "0208 455 2454",
  contactWhatsapp: "07498 445554",
  contactEmail: "orders@kosherparadise.co.uk",
  contactAddress: "10 Ashbourne Parade, Finchley Road, London, NW11 0AD",
  openingTimes: [
    "Thursday 19th March: 8AM-10PM",
    "Friday 20th March: 7AM-5:30PM",
    "Sunday 22nd to Thursday 26th March: 8AM-10PM",
    "Friday 27th March: 7AM-6PM",
    "Sunday 29th to Tuesday 31st March: 8AM-10PM",
    "Wednesday 1st April: 7AM-7PM",
    "Last time for eating Chametz: 10:55AM",
    "Last time to burn Chametz: 12:00PM",
    "First Night Pesach: Wednesday 1st April",
    "Open throughout Chol Hamoed",
    "Sunday 5th April: 8AM-10PM",
    "Monday 6th April: 8AM-10PM",
    "Tuesday 7th April: 7AM-7PM",

    
  ],
  deliveryWindowStart: "2026-03-24",
  deliveryWindowEnd: "2026-04-07",
  deliverySlots
};
