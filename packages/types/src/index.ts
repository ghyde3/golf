export interface UserRole {
  role: "platform_admin" | "club_admin" | "staff" | "golfer";
  clubId: string | null;
}

export interface JWTPayload {
  userId: string;
  roles: UserRole[];
}

export interface GeneratedSlot {
  datetime: Date;
  maxPlayers: number;
  bookedPlayers: number;
  status: "open" | "blocked";
  price: number | null;
  slotType: "18hole" | "9hole" | "27hole" | "36hole";
}
