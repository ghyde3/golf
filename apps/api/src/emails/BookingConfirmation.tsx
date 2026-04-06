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
};

export function BookingConfirmationEmail({
  clubName,
  bookingRef,
  whenLabel,
  playersCount,
  notes,
  manageUrl,
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
