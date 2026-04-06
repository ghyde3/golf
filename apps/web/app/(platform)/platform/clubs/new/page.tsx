import { PlatformNewClubTopBar } from "@/components/platform/PlatformNewClubTopBar";
import { CreateClubForm } from "./CreateClubForm";

export default function NewClubPage() {
  return (
    <>
      <PlatformNewClubTopBar />
      <div className="p-6">
        <p className="mb-6 text-sm text-muted">
          Creates the club and a default configuration row.
        </p>
        <CreateClubForm />
      </div>
    </>
  );
}
