import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function GolferLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?redirect=/account");
  }

  return (
    <div className="min-h-screen bg-ds-warm-white text-ds-ink antialiased">
      {children}
    </div>
  );
}
