import Link from "next/link";

type SuccessSearchParams = {
  ref?: string | string[];
  emailSent?: string | string[];
};

interface SuccessPageProps {
  searchParams?: SuccessSearchParams | Promise<SuccessSearchParams>;
}

function asSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const resolvedSearchParams = await searchParams;
  const orderRef = asSingleValue(resolvedSearchParams?.ref) ?? "Unknown";
  const emailSent = asSingleValue(resolvedSearchParams?.emailSent) === "1";

  return (
    <main className="page-shell">
      <section className="panel stack-md">
        <h1 className="headline">Order Submitted</h1>
        <p>
          Your order reference is <strong>{orderRef}</strong>.
        </p>
        <p className="subtle">
          {emailSent
            ? "A confirmation email was sent to the address you provided."
            : "No customer confirmation email was sent for this order."}
        </p>
        <p className="subtle">
          If you need to make changes, contact the store and mention your order reference.
        </p>
        <div>
          <Link href="/">Place another order</Link>
        </div>
      </section>
    </main>
  );
}
