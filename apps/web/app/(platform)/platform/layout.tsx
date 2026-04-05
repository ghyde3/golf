import Link from "next/link";
import { LogoutButton } from "../../../components/LogoutButton";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/platform" className="font-semibold text-white">
              Platform
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/platform/clubs"
                className="text-slate-400 hover:text-white transition-colors"
              >
                Clubs
              </Link>
            </nav>
          </div>
          <LogoutButton />
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
