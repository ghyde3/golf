import Link from "next/link";
import { CreateClubForm } from "./CreateClubForm";

export default function NewClubPage() {
  return (
    <div>
      <Link
        href="/platform/clubs"
        className="text-sm text-slate-400 hover:text-white mb-6 inline-block"
      >
        ← Back to clubs
      </Link>
      <h1 className="text-2xl font-semibold text-white mb-2">New club</h1>
      <p className="text-slate-400 text-sm mb-8">
        Creates the club and a default configuration row.
      </p>
      <CreateClubForm />
    </div>
  );
}
