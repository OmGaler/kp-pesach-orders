import Link from "next/link";

interface SuccessPageProps {
  searchParams?: {
    ref?: string;
    emailSent?: string;
  };
}

export default function SuccessPage({ searchParams }: SuccessPageProps) {
  const orderRef = searchParams?.ref ?? "Unknown";
  const emailSent = searchParams?.emailSent === "1";

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
