import * as React from "react";
import {
  Body,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export type BookingCancellationProps = {
  clubName: string;
  whenLabel?: string;
};

export function BookingCancellationEmail({
  clubName,
  whenLabel,
}: BookingCancellationProps) {
  return (
    <Html>
      <Head />
      <Preview>Booking cancelled — {clubName}</Preview>
      <Body style={main}>
        <Heading style={h1}>Booking cancelled</Heading>
        <Text style={text}>
          Your tee time at <strong>{clubName}</strong> has been cancelled.
        </Text>
        {whenLabel ? <Text style={text}>{whenLabel}</Text> : null}
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const h1 = { color: "#111", fontSize: "22px" };
const text = { color: "#333", fontSize: "14px", lineHeight: "22px" };
