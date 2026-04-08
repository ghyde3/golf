import { Resend } from "resend";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(
      `[email:dev] To: ${opts.to}\nSubject: ${opts.subject}\n---\n${opts.html}\n---`
    );
    return;
  }
  const resend = new Resend(key);
  const from = process.env.RESEND_FROM ?? "TeeTimes <onboarding@resend.dev>";
  await resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html });
}
