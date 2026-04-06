export type TeeSlotRow = {
  id: string | null;
  datetime: string;
  maxPlayers: number;
  bookedPlayers: number;
  status: string;
  price: number | null;
  slotType: string;
  bookingId?: string | null;
  bookingRef?: string | null;
};

export type BookingDetail = {
  id: string;
  bookingRef: string;
  guestName: string | null;
  guestEmail: string | null;
  playersCount: number;
  notes: string | null;
  status: string | null;
  paymentStatus: string | null;
  createdAt: string;
  teeSlot: {
    id: string;
    datetime: string;
    price: number | null;
    courseId: string;
    courseName: string;
  };
  players: {
    id: string;
    name: string | null;
    email: string | null;
    checkedIn: boolean | null;
    noShow: boolean | null;
  }[];
};
