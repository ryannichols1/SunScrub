// netlify/functions/contact.js
// Receives contact form submissions and emails them to the SolarScrub inbox via Resend.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { name, email, phone, message } = body;

  if (!name || !email || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: "name, email, and message are required" }) };
  }

  const subject = `New Contact Form Message — ${name}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;color:#1C1917;max-width:560px;margin:0 auto;padding:32px 24px;">
  <div style="border-bottom:3px solid #0D9488;padding-bottom:16px;margin-bottom:28px;">
    <h1 style="margin:0;font-size:22px;color:#0D9488;">New Contact Message</h1>
    <p style="margin:6px 0 0;color:#57534E;font-size:14px;">SolarScrub · Solar Panel Cleaning</p>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#57534E;font-size:14px;width:140px;">Name</td><td style="padding:10px 0;border-bottom:1px solid #E7E5E4;font-size:14px;font-weight:600;">${escapeHtml(name)}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#57534E;font-size:14px;">Email</td><td style="padding:10px 0;border-bottom:1px solid #E7E5E4;font-size:14px;font-weight:600;">${escapeHtml(email)}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#57534E;font-size:14px;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #E7E5E4;font-size:14px;font-weight:600;">${phone ? escapeHtml(phone) : "—"}</td></tr>
  </table>
  <div style="margin-top:24px;">
    <p style="font-size:13px;color:#57534E;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">Message</p>
    <div style="background:#F4F1EB;border-radius:10px;padding:20px;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
  </div>
  <p style="margin-top:32px;font-size:12px;color:#A8A29E;">Sent via solarscrub.ie contact form</p>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SolarScrub Contact <onboarding@resend.dev>",
      to:   ["ryanjnichols97@gmail.com"],
      reply_to: email,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Resend error:", errBody);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to send email" }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
