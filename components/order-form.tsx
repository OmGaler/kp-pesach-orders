"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { StoreConfig } from "@/config/store";
import { buildProductSearchIndex, searchCatalog } from "@/lib/product-search";
import type { Category, DeliverySlot, OrderPayload } from "@/types/order";

interface OrderFormProps {
  catalog: Category[];
  storeConfig: StoreConfig;
}

interface ContactState {
  customerName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  email: string;
  notes: string;
}

const emptyContactState: ContactState = {
  customerName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  postcode: "",
  email: "",
  notes: ""
};

function buildInitialDate(minDate: string): string {
  return minDate;
}

function clampQty(value: number): number {
  if (Number.isNaN(value) || value < 0) {
    return 0;
  }
  if (value > 99) {
    return 99;
  }
  return Math.trunc(value);
}

export function OrderForm({ catalog, storeConfig }: OrderFormProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    buildInitialDate(storeConfig.deliveryWindowStart)
  );
  const [deliverySlot, setDeliverySlot] = useState<DeliverySlot>("AM");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [contact, setContact] = useState<ContactState>(emptyContactState);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasSearch = search.trim().length > 0;
  const allCategoryNames = useMemo(() => catalog.map((category) => category.name), [catalog]);
  const searchIndex = useMemo(() => buildProductSearchIndex(catalog), [catalog]);
  const areAllCollapsed = useMemo(
    () =>
      allCategoryNames.length > 0 &&
      allCategoryNames.every((name) => Boolean(collapsedCategories[name])),
    [allCategoryNames, collapsedCategories]
  );

  const visibleCatalog = useMemo(() => {
    if (!hasSearch) {
      return catalog;
    }
    return searchCatalog(searchIndex, search);
  }, [catalog, hasSearch, search, searchIndex]);

  const visibleProductCount = useMemo(
    () => visibleCatalog.reduce((sum, category) => sum + category.products.length, 0),
    [visibleCatalog]
  );

  const totalUnits = useMemo(
    () => Object.values(quantities).reduce((sum, qty) => sum + qty, 0),
    [quantities]
  );

  function setProductQty(productId: string, qty: number) {
    const normalized = clampQty(qty);
    setQuantities((prev) => {
      if (normalized === 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: normalized };
    });
  }

  function updateContactField<K extends keyof ContactState>(key: K, value: ContactState[K]) {
    setContact((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  function toggleCategory(categoryName: string) {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  }

  function collapseAllCategories() {
    setCollapsedCategories(
      Object.fromEntries(allCategoryNames.map((name) => [name, true])) as Record<string, boolean>
    );
  }

  function expandAllCategories() {
    setCollapsedCategories({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }));

    if (!items.length) {
      setSubmitError("Please add at least one product quantity before submitting.");
      return;
    }

    const payload: OrderPayload = {
      items,
      deliveryDate,
      deliverySlot,
      customerName: contact.customerName,
      phone: contact.phone,
      addressLine1: contact.addressLine1,
      addressLine2: contact.addressLine2 || undefined,
      postcode: contact.postcode,
      email: contact.email || undefined,
      notes: contact.notes || undefined
    };

    setLoading(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as
        | { ok: true; orderRef: string; customerEmailSent: boolean }
        | { ok: false; error: string };

      if (!response.ok || !body.ok) {
        setSubmitError("error" in body ? body.error : "Order submission failed");
        return;
      }

      setQuantities({});
      setContact(emptyContactState);
      setDeliveryDate(buildInitialDate(storeConfig.deliveryWindowStart));
      setDeliverySlot("AM");
      setSearch("");
      const emailSent = body.customerEmailSent ? "1" : "0";
      router.push(`/success?ref=${encodeURIComponent(body.orderRef)}&emailSent=${emailSent}`);
    } catch {
      setSubmitError("Could not submit order. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack-md">
      <section className="panel stack-md">
        <div className="stack-sm">
          <Image
            src="/logo.png"
            alt="KP logo"
            width={112}
            height={112}
            className="brand-logo"
            priority
          />
          <h1 className="headline">KP Pesach Order Form</h1>
          <p className="subtle">Search items, choose quantities, and submit your delivery request.</p>
        </div>
      </section>

      <section className="page-grid">
        <div className="panel stack-md">
          <div className="field">
            <label htmlFor="search">Search products</label>
            <div className="search-bar">
              <input
                id="search"
                type="text"
                className="search-input"
                placeholder="Try chrayne, charoses, grape juice..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoComplete="off"
              />
              {hasSearch ? (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <p className="subtle search-helper">
              {hasSearch
                ? `${visibleProductCount} matching product${visibleProductCount === 1 ? "" : "s"}`
                : "Fuzzy search handles spelling/transliteration variations."}
            </p>
            <div className="search-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={areAllCollapsed ? expandAllCategories : collapseAllCategories}
                disabled={hasSearch}
              >
                {areAllCollapsed ? "Expand all categories" : "Collapse all categories"}
              </button>
            </div>
          </div>

          {visibleCatalog.length === 0 ? (
            <p className="subtle">No products matched your search.</p>
          ) : null}

          {visibleCatalog.map((category) => (
            <article className="category-block" key={category.name}>
              <button
                type="button"
                className="category-toggle"
                onClick={() => {
                  if (!hasSearch) {
                    toggleCategory(category.name);
                  }
                }}
                aria-expanded={hasSearch || !collapsedCategories[category.name]}
              >
                <span>{category.name}</span>
                <span className="category-toggle-meta">
                  {category.products.length} items{" "}
                  {hasSearch ? "" : collapsedCategories[category.name] ? "+" : "-"}
                </span>
              </button>
              {(hasSearch || !collapsedCategories[category.name])
                ? category.products.map((product) => {
                    const qty = quantities[product.id] ?? 0;
                    return (
                      <div className="product-row" key={product.id}>
                        <div className="stack-sm">
                          <strong>{product.name}</strong>
                          {product.size ? <span className="pill">{product.size}</span> : null}
                        </div>
                        <div className="qty-wrap">
                          <button
                            type="button"
                            className="btn-qty"
                            aria-label={`Decrease quantity for ${product.name}`}
                            onClick={() => setProductQty(product.id, qty - 1)}
                          >
                            -
                          </button>
                          <input
                            className="qty-input"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={qty}
                            aria-label={`Quantity for ${product.name}`}
                            onChange={(event) =>
                              setProductQty(
                                product.id,
                                Number.parseInt(event.target.value || "0", 10)
                              )
                            }
                          />
                          <button
                            type="button"
                            className="btn-qty"
                            aria-label={`Increase quantity for ${product.name}`}
                            onClick={() => setProductQty(product.id, qty + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })
                : null}
            </article>
          ))}
        </div>

        <aside className="stack-md">
          <section className="panel stack-md">
            <h2>Store details</h2>
            <p>
              Contact: <strong>{storeConfig.contactPhone}</strong>
              <br />
              Email: <strong>{storeConfig.contactEmail}</strong>
            </p>
            <div className="stack-sm">
              <strong>Opening times</strong>
              {storeConfig.openingTimes.map((line) => (
                <span className="subtle" key={line}>
                  {line}
                </span>
              ))}
            </div>
          </section>

          <section className="panel stack-md">
            <h2>Delivery</h2>
            <div className="inline-grid">
              <div className="field">
                <label htmlFor="deliveryDate">Delivery date</label>
                <input
                  id="deliveryDate"
                  type="date"
                  min={storeConfig.deliveryWindowStart}
                  max={storeConfig.deliveryWindowEnd}
                  value={deliveryDate}
                  onChange={(event) => setDeliveryDate(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="deliverySlot">AM / PM</label>
                <select
                  id="deliverySlot"
                  value={deliverySlot}
                  onChange={(event) => setDeliverySlot(event.target.value as DeliverySlot)}
                  required
                >
                  {storeConfig.deliverySlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="panel stack-md">
            <h2>Contact details</h2>
            <div className="field">
              <label htmlFor="customerName">Full name</label>
              <input
                id="customerName"
                value={contact.customerName}
                onChange={(event) => updateContactField("customerName", event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={contact.phone}
                onChange={(event) => updateContactField("phone", event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="addressLine1">Address line 1</label>
              <input
                id="addressLine1"
                value={contact.addressLine1}
                onChange={(event) => updateContactField("addressLine1", event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="addressLine2">Address line 2</label>
              <input
                id="addressLine2"
                value={contact.addressLine2}
                onChange={(event) => updateContactField("addressLine2", event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="postcode">Postcode</label>
              <input
                id="postcode"
                autoComplete="postal-code"
                value={contact.postcode}
                onChange={(event) => updateContactField("postcode", event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="email">Email (optional)</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={contact.email}
                onChange={(event) => updateContactField("email", event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="notes">Notes (optional)</label>
              <textarea
                id="notes"
                value={contact.notes}
                onChange={(event) => updateContactField("notes", event.target.value)}
              />
            </div>
          </section>

          <section className="panel stack-sm mobile-submit">
            <strong>Total units selected: {totalUnits}</strong>
            {submitError ? <p className="error">{submitError}</p> : null}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Submitting..." : "Submit order"}
            </button>
          </section>
        </aside>
      </section>
    </form>
  );
}
