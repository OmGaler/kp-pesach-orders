export type DeliverySlot = "AM" | "PM";

export interface Product {
  id: string;
  category: string;
  name: string;
  size: string | null;
  sortIndex: number;
}

export interface Category {
  name: string;
  products: Product[];
}

export interface CartItemInput {
  productId: string;
  qty: number;
}

export interface OrderPayload {
  items: CartItemInput[];
  deliveryDate: string;
  deliverySlot: DeliverySlot;
  allowKitniyot: boolean;
  customerName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  postcode: string;
  email?: string;
  notes?: string;
}

export interface NormalizedOrderItem {
  productId: string;
  name: string;
  size: string | null;
  qty: number;
}

export interface NormalizedOrder extends Omit<OrderPayload, "items"> {
  orderRef: string;
  createdAtIso: string;
  items: NormalizedOrderItem[];
}
