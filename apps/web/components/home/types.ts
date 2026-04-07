export type PublicClubTag = {
  slug: string;
  label: string;
};

export type PublicClubListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  heroImageUrl: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  coursesCount: number;
  maxHoles: number;
  createdAt: string | null;
  tags?: PublicClubTag[];
};
