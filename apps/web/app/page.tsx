export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-green-50">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-green-800 mb-4">
          TeeTimes
        </h1>
        <p className="text-xl text-green-600 mb-8">
          Golf Tee Time Booking Platform
        </p>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
          <p className="text-gray-600">
            Book your next round of golf in seconds.
          </p>
          <a
            href="/book/pinebrook"
            className="mt-4 inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            Book a Tee Time
          </a>
        </div>
      </div>
    </main>
  );
}
