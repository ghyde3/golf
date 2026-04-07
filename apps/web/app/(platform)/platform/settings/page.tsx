import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import Link from "next/link";
import { Globe, Mail, ShieldCheck, ToggleLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const cards = [
  {
    href: "/platform/settings/general",
    title: "General",
    description: "Platform name, logo, support email, timezone",
    icon: Globe,
  },
  {
    href: "/platform/settings/feature-flags",
    title: "Feature flags",
    description: "Enable or disable platform features",
    icon: ToggleLeft,
  },
  {
    href: "/platform/settings/security",
    title: "Security",
    description: "Session timeout, allowed domains, password policy",
    icon: ShieldCheck,
  },
  {
    href: "/platform/settings/email",
    title: "Email",
    description: "Booking confirmation and reminder templates",
    icon: Mail,
  },
] as const;

export default function PlatformSettingsPage() {
  return (
    <>
      <SetPlatformTopBar title="Settings" />
      <div className="p-6">
        <p className="mb-5 text-sm text-muted">
          Configure platform-wide defaults and policies.
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
