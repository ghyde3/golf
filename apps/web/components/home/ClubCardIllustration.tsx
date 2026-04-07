export function ClubCardIllustration({ variant }: { variant: "a" | "b" }) {
  if (variant === "a") {
    return (
      <svg
        className="h-full w-full"
        viewBox="0 0 220 130"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="220" height="130" fill="#1a3a2a" />
        <ellipse cx="110" cy="80" rx="120" ry="60" fill="#2d5a3d" opacity={0.8} />
        <ellipse cx="160" cy="40" rx="60" ry="40" fill="#4a8c5c" opacity={0.5} />
        <rect x="0" y="100" width="220" height="30" fill="#1a3a2a" opacity={0.6} />
        <circle cx="50" cy="50" r="20" fill="#4a8c5c" opacity={0.3} />
      </svg>
    );
  }
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 220 130"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="220" height="130" fill="#2d4a1a" />
      <ellipse cx="80" cy="90" rx="130" ry="50" fill="#4a7a2d" opacity={0.7} />
      <ellipse cx="180" cy="30" rx="70" ry="50" fill="#6a9a3d" opacity={0.4} />
      <circle cx="170" cy="70" r="25" fill="#3a6a1a" opacity={0.4} />
    </svg>
  );
}
