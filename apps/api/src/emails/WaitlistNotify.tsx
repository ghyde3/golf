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

export type WaitlistNotifyProps = {
  clubName: string;
  whenLabel: string;
  claimUrl: string;
  playersCount: number;
};

export function WaitlistNotifyEmail({
  clubName,
  whenLabel,
  claimUrl,
  playersCount,
}: WaitlistNotifyProps) {
  return (
    <Html>
      <Head />
      <Preview>A spot opened at {clubName}</Preview>
      <Body style={main}>
        <Heading style={h1}>A spot has opened up!</Heading>
        <Text style={text}>
          <strong>{clubName}</strong>
        </Text>
        <Text style={text}>Tee time: {whenLabel}</Text>
        <Text style={text}>
          Party size: {playersCount} player{playersCount !== 1 ? "s" : ""}
        </Text>
        <Section style={btnContainer}>
          <Link href={claimUrl} style={button}>
            Claim your spot
          </Link>
        </Section>
        <Text style={finePrint}>
          This link expires in 24 hours. If you no longer need this time, you can ignore this
          email.
        </Text>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const h1 = { color: "#111", fontSize: "24px" };
const text = { color: "#333", fontSize: "14px", lineHeight: "22px" };
const btnContainer = { marginTop: "24px" };
const button = {
  backgroundColor: "#d97706",
  color: "#fff",
  padding: "12px 20px",
  borderRadius: "8px",
  textDecoration: "none",
  display: "inline-block",
};
const finePrint = {
  color: "#666",
  fontSize: "12px",
  lineHeight: "18px",
  marginTop: "24px",
};
