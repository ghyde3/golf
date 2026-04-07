import type { Metadata } from "next";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DM_Mono, DM_Sans, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "700"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  weight: ["400", "500"],
});

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
    <html
      lang="en"
      className={`${dmSans.variable} ${playfair.variable} ${dmMono.variable}`}
    >
      <body className="font-sans">
        <AuthSessionProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
