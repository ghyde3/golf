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
  guestName?: string | null;
  /** Players in the booking (for capacity when dragging); may equal bookedPlayers when one booking per slot */
  bookingPlayersCount?: number | null;
};

export type BookingDetail = {
  id: string;
  bookingRef: string;
  source: "online_guest" | "online_user" | "staff";
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
    clubId?: string;
  };
  players: {
    id: string;
    name: string | null;
    email: string | null;
    checkedIn: boolean | null;
    noShow: boolean | null;
  }[];
  addons?: {
    id: string;
    addonCatalogId: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    catalogUnitsConsumed?: number;
    bookingStart: string | null;
    bookingEnd: string | null;
    status: string;
    resourceTypeId: string | null;
    assignmentStrategy: string;
    trackingMode: string | null;
    assignments: {
      id: string;
      resourceItemId: string;
      label: string;
      supersededAt: string | null;
    }[];
  }[];
};
