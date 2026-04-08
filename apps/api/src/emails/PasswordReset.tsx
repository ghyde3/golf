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

export type PasswordResetProps = {
  resetUrl: string;
  userName?: string;
};

export function PasswordResetEmail({ resetUrl, userName }: PasswordResetProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your TeeTimes password</Preview>
      <Body style={main}>
        <Heading style={h1}>Reset your password</Heading>
        {userName ? <Text style={text}>Hi {userName},</Text> : null}
        <Text style={text}>
          We received a request to reset your TeeTimes password. Click the button below to set a
          new password.
        </Text>
        <Section style={btnContainer}>
          <Link href={resetUrl} style={button}>
            Reset password
          </Link>
        </Section>
        <Text style={finePrint}>
          This link expires in 1 hour. If you didn&apos;t request a reset, you can ignore this
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
