import { OrderForm } from "@/components/order-form";
import { storeConfig } from "@/config/store";
import { getCatalog } from "@/lib/catalog";

export default function HomePage() {
  const catalog = getCatalog();

  return (
    <main className="page-shell">
      <OrderForm catalog={catalog} storeConfig={storeConfig} />
    </main>
  );
}
