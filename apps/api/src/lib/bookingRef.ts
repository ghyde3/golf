const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBookingRef(clubSlug: string): string {
  const prefix = clubSlug.replace(/-/g, "").slice(0, 4).toUpperCase();
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return `${prefix}-${code}`;
}
