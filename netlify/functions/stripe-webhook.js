// netlify/functions/stripe-webhook.js
// Handles Stripe webhook events (payment confirmation, expiry, etc.)

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
        panels: session.metadata.panel_count,
        address: session.metadata.address,
        amount: session.amount_total,
        email: session.customer_details?.email,
      });
      // TODO: Send confirmation email, update database, notify team
      // You can integrate with SendGrid, Resend, or any email service here
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
