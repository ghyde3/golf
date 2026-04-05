import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeeTimes - Golf Tee Time Booking",
  description: "Book golf tee times online",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
