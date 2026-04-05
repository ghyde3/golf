const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getClubProfile(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/clubs/public/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ClubProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const club = await getClubProfile(params.slug);

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-green-700 to-green-900 text-white">
        <div className="max-w-md mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl font-bold mb-2">
            {club?.name ?? params.slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
          </h1>
          <p className="text-green-200 text-sm">
            {club?.description ?? "Golf Club"}
          </p>
        </div>
      </div>

      {/* Quick facts */}
      <div className="max-w-md mx-auto px-4 -mt-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-2xl font-bold text-green-700">18</div>
              <div className="text-gray-500">Holes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">
                {club?.config?.openTime?.slice(0, 5) ?? "06:00"}
              </div>
              <div className="text-gray-500">Opens</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">
                {club?.config?.closeTime?.slice(0, 5) ?? "18:00"}
              </div>
              <div className="text-gray-500">Closes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Courses */}
      <div className="max-w-md mx-auto px-4 mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Courses</h2>
        {club?.courses && club.courses.length > 0 ? (
          <div className="space-y-2">
            {club.courses.map((course: { id: string; name: string; holes: number }) => (
              <div
                key={course.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium text-gray-700">{course.name}</span>
                <span className="text-sm text-gray-500">{course.holes} holes</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            No courses configured yet. Check back soon!
          </p>
        )}
      </div>

      {/* About */}
      {club?.description && (
        <div className="max-w-md mx-auto px-4 mt-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">About</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            {club.description}
          </p>
        </div>
      )}

      {/* Hours */}
      <div className="max-w-md mx-auto px-4 mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Hours</h2>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Weekdays</span>
            <span className="text-gray-800 font-medium">
              {club?.config?.openTime?.slice(0, 5) ?? "06:00"} –{" "}
              {club?.config?.closeTime?.slice(0, 5) ?? "18:00"}
            </span>
          </div>
          {club?.config?.schedule?.map(
            (s: { dayOfWeek: number; openTime: string; closeTime: string }) => (
              <div key={s.dayOfWeek} className="flex justify-between">
                <span className="text-gray-600">
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][s.dayOfWeek]}
                </span>
                <span className="text-gray-800 font-medium">
                  {s.openTime} – {s.closeTime}
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-md mx-auto px-4 py-8">
        <button className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-semibold hover:bg-green-700 transition-colors shadow-md">
          Book a Tee Time
        </button>
      </div>
    </main>
  );
}
