import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import Link from "next/link";
import { BarChart3, Building2, FileText, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const cards = [
  {
    href: "/platform/billing/overview",
    title: "Overview",
    description: "Revenue metrics and monthly breakdown",
    icon: BarChart3,
  },
  {
    href: "/platform/billing/subscriptions",
    title: "Subscriptions",
    description: "Club subscription types and booking fees",
    icon: Building2,
  },
  {
    href: "/platform/billing/invoices",
    title: "Invoices",
    description: "View and manage all club invoices",
    icon: FileText,
  },
  {
    href: "/platform/billing/stripe",
    title: "Stripe",
    description: "Stripe API configuration and webhook status",
    icon: Zap,
  },
] as const;

export default function PlatformBillingPage() {
  return (
    <>
      <SetPlatformTopBar title="Billing" />
      <div className="p-6">
        <p className="mb-5 text-sm text-muted">
          Platform revenue, club subscriptions, invoices, and Stripe integration.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map(({ href, title, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex flex-col gap-3 rounded-xl border border-stone bg-white p-5 shadow-sm transition-all",
                "hover:border-fairway/50 hover:shadow-md"
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cream text-fairway transition-colors group-hover:bg-fairway/10">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-lg text-ink group-hover:text-fairway">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-muted">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
