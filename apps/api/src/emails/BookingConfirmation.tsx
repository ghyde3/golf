import * as React from "react";
import {
  Body,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type BookingConfirmationProps = {
  clubName: string;
  bookingRef: string;
  whenLabel: string;
  playersCount: number;
  notes?: string | null;
  manageUrl: string;
  addonLines?: { name: string; quantity: number; lineTotalCents: number }[];
  addonsTotalCents?: number;
};

export function BookingConfirmationEmail({
  clubName,
  bookingRef,
  whenLabel,
  playersCount,
  notes,
  manageUrl,
  addonLines,
  addonsTotalCents,
}: BookingConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Tee time confirmed — {bookingRef}</Preview>
      <Body style={main}>
        <Heading style={h1}>You&apos;re booked</Heading>
        <Text style={text}>
          <strong>{clubName}</strong>
        </Text>
        <Text style={text}>
          Reference: <strong>{bookingRef}</strong>
        </Text>
        <Text style={text}>Tee time: {whenLabel}</Text>
        <Text style={text}>Players: {playersCount}</Text>
        {addonLines && addonLines.length > 0 ? (
          <Section style={{ marginTop: "12px" }}>
            <Text style={{ ...text, fontWeight: 600 }}>Add-ons</Text>
            {addonLines.map((line, i) => (
              <Text key={i} style={text}>
                {line.name} × {line.quantity} — $
                {(line.lineTotalCents / 100).toFixed(2)}
              </Text>
            ))}
            {addonsTotalCents != null && addonsTotalCents > 0 ? (
              <Text style={{ ...text, marginTop: "6px", fontWeight: 600 }}>
                Add-ons total: ${(addonsTotalCents / 100).toFixed(2)}
              </Text>
            ) : null}
          </Section>
        ) : null}
        {notes ? <Text style={text}>Notes: {notes}</Text> : null}
        <Section style={btnContainer}>
          <Link href={manageUrl} style={button}>
            Manage booking
          </Link>
        </Section>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const h1 = { color: "#111", fontSize: "24px" };
const text = { color: "#333", fontSize: "14px", lineHeight: "22px" };
const btnContainer = { marginTop: "24px" };
const button = {
  backgroundColor: "#16a34a",
  color: "#fff",
  padding: "12px 20px",
  borderRadius: "8px",
  textDecoration: "none",
};
