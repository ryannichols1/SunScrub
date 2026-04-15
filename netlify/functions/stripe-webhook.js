// netlify/functions/stripe-webhook.js
// Handles Stripe webhook events (payment confirmation, expiry, etc.)

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

async function sendBookingEmail(session) {
  const meta = session.metadata || {};
  const details = session.customer_details || {};

  const customerName   = meta.customer_name  || "Unknown";
  const address        = meta.address        || "—";
  const eircode        = meta.eircode        || "—";
  const panelCount     = meta.panel_count    || "—";
  const preferredDate  = meta.preferred_date || "—";
  const email          = details.email       || "—";
  const phone          = details.phone       || "—";
  const amountEuros    = session.amount_total != null
    ? "€" + (session.amount_total / 100).toFixed(2)
    : "—";
  const paymentTime    = new Date(session.created * 1000).toUTCString();

  const subject = `New Booking — ${customerName} — ${preferredDate}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;color:#1C1917;max-width:560px;margin:0 auto;padding:32px 24px;">
  <div style="border-bottom:3px solid #0D9488;padding-bottom:16px;margin-bottom:28px;">
    <h1 style="margin:0;font-size:22px;color:#0D9488;">New Booking Received</h1>
    <p style="margin:6px 0 0;color:#57534E;font-size:14px;">SolarScrub · Solar Panel Cleaning</p>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:15px;">
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#78716C;width:40%;vertical-align:top;">Customer Name</td>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;font-weight:600;">${customerName}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#78716C;vertical-align:top;">Email</td>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;">${email}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#78716C;vertical-align:top;">Phone</td>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;">${phone}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#78716C;vertical-align:top;">Property Address</td>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;">${address}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#78716C;vertical-align:top;">Eircode</td>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;">${eircode}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#78716C;vertical-align:top;">Number of Panels</td>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;">${panelCount}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#78716C;vertical-align:top;">Preferred Date</td>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;font-weight:600;color:#0D9488;">${preferredDate}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;color:#78716C;vertical-align:top;">Amount Paid</td>
      <td style="padding:10px 0;border-bottom:1px solid #E7E5E4;font-weight:700;font-size:17px;">${amountEuros}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#78716C;vertical-align:top;">Payment Time</td>
      <td style="padding:10px 0;color:#57534E;">${paymentTime}</td>
    </tr>
  </table>

  <p style="margin-top:28px;font-size:13px;color:#A8A29E;">
    Stripe session ID: ${session.id}
  </p>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SolarScrub Bookings <onboarding@resend.dev>",
      to:   ["ryanjnichols97@gmail.com"],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  return await res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  switch (stripeEvent.type) {
    case "checkout.session.completed": {
      const session = stripeEvent.data.object;
      console.log("Payment succeeded:", {
        customer: session.metadata.customer_name,
        panels:   session.metadata.panel_count,
        address:  session.metadata.address,
        amount:   session.amount_total,
        email:    session.customer_details?.email,
      });

      try {
        await sendBookingEmail(session);
        console.log("Booking notification email sent successfully.");
      } catch (err) {
        // Log but don't fail the webhook — Stripe must receive 200
        console.error("Failed to send booking email:", err.message);
      }
      break;
    }

    case "checkout.session.expired": {
      const session = stripeEvent.data.object;
      console.log("Checkout expired for:", session.metadata.customer_name);
      break;
    }

    default:
      console.log("Unhandled event type:", stripeEvent.type);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
