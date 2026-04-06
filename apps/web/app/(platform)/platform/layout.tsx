import { PlatformShell } from "@/components/platform/PlatformShell";
import { auth } from "@/auth";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "User";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <PlatformShell userName={displayName} userInitials={initials}>
      {children}
    </PlatformShell>
  );
}
