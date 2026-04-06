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

export type BookingReminderProps = {
  clubName: string;
  bookingRef: string;
  whenLabel: string;
  manageUrl: string;
};

export function BookingReminderEmail({
  clubName,
  bookingRef,
  whenLabel,
  manageUrl,
}: BookingReminderProps) {
  return (
    <Html>
      <Head />
      <Preview>Reminder: tee time tomorrow — {bookingRef}</Preview>
      <Body style={main}>
        <Heading style={h1}>Tee time reminder</Heading>
        <Text style={text}>{clubName}</Text>
        <Text style={text}>
          Ref <strong>{bookingRef}</strong> · {whenLabel}
        </Text>
        <Section style={btnContainer}>
          <Link href={manageUrl} style={button}>
            View details
          </Link>
        </Section>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const h1 = { color: "#111", fontSize: "22px" };
const text = { color: "#333", fontSize: "14px", lineHeight: "22px" };
const btnContainer = { marginTop: "20px" };
const button = {
  backgroundColor: "#15803d",
  color: "#fff",
  padding: "12px 20px",
  borderRadius: "8px",
  textDecoration: "none",
};
