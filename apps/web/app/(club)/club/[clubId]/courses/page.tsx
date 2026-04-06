import { clubApi } from "@/lib/admin-api";
import { CoursesClient, type CourseRow } from "./CoursesClient";

export default async function ClubCoursesPage({
  params,
}: {
  params: { clubId: string };
}) {
  const res = await clubApi(params.clubId, "/courses");
  if (!res.ok) {
    return (
      <p className="p-6 text-muted">
        Could not load courses. You may not have access.
      </p>
    );
  }
  const courses = (await res.json()) as CourseRow[];
  return <CoursesClient clubId={params.clubId} courses={courses} />;
}
