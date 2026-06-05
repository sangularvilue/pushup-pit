// Provider-agnostic transactional email. Uses Resend if RESEND_API_KEY is set,
// otherwise logs to the server console. Same pattern as wedding-tables.

export interface SendResult {
  delivered: boolean;
}

export function baseUrl(reqUrl: string): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  try {
    return new URL(reqUrl).origin;
  } catch {
    return "https://pushups.grannis.xyz";
  }
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.TRADE_FROM_EMAIL || "Pushup Pit <onboarding@resend.dev>";
  if (!key) {
    console.log(
      `[email] (no RESEND_API_KEY) would send to ${opts.to}: ${opts.subject}\n${opts.text}`
    );
    return { delivered: false };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend error", res.status, await res.text());
      return { delivered: false };
    }
    return { delivered: true };
  } catch (e) {
    console.error("[email] send failed", e);
    return { delivered: false };
  }
}
