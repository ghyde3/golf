export type MeBookingTeeSlot = {
  datetime: string;
  courseName: string;
  clubName: string;
  clubSlug: string;
  timezone: string;
  clubId: string;
  courseId: string;
  holes: number;
};

export type MeBookingItem = {
  id: string;
  bookingRef: string;
  status: string;
  playersCount: number;
  createdAt: string;
  isCancellable: boolean;
  totalCents: number;
  paymentStatus: string;
  teeSlot: MeBookingTeeSlot;
};

export type MeBookingsResponse = {
  upcoming: MeBookingItem[];
  past: MeBookingItem[];
  total: number;
};

export type ScorecardItem = {
  id: string;
  totalScore: number;
  completedHoles: number;
  createdAt: string | null;
  holes: { holeNumber: number; score: number }[];
  booking: {
    bookingRef: string;
    teeSlot: {
      datetime: string;
      courseName: string;
      clubName: string;
      clubId: string;
      courseId: string;
    } | null;
  } | null;
};
