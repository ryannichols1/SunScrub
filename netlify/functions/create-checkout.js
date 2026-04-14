// netlify/functions/create-checkout.js
// Creates a Stripe Checkout Session for a one-time panel cleaning payment
// Pricing: €39 callout + €7 per panel

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { name, email, phone, address, eircode, panelCount } = JSON.parse(event.body);

    // Validate
    if (!name || !email || !phone || !address || !panelCount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields: name, email, phone, address, panelCount" }),
      };
    }

    const panels = parseInt(panelCount);
    if (isNaN(panels) || panels < 1 || panels > 200) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Panel count must be between 1 and 200" }),
      };
    }

    // Calculate price
    const calloutCents = 3900;   // €39
    const perPanelCents = 700;   // €7
    const totalCents = calloutCents + (panels * perPanelCents);

    // Create or find Stripe customer
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer;

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      // Update their details
      await stripe.customers.update(customer.id, {
        name,
        phone,
        metadata: { address, eircode: eircode || "", panel_count: String(panels) },
      });
    } else {
      customer = await stripe.customers.create({
        name,
        email,
        phone,
        metadata: { address, eircode: eircode || "", panel_count: String(panels), source: "sunscrub.ie" },
      });
    }

    // Create Checkout Session
    const siteUrl = process.env.URL || "http://localhost:8888";

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: calloutCents,
            product_data: {
              name: "SunScrub — Callout Fee",
              description: "One-time callout fee for solar panel cleaning in the Dublin area",
            },
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "eur",
            unit_amount: perPanelCents,
            product_data: {
              name: "SunScrub — Per Panel Clean",
              description: `Professional cleaning per solar panel using deionised water`,
            },
          },
          quantity: panels,
        },
      ],
      metadata: {
        customer_name: name,
        address,
        eircode: eircode || "",
        panel_count: String(panels),
      },
      success_url: `${siteUrl}/?success=true&panels=${panels}`,
      cancel_url: `${siteUrl}/?cancelled=true`,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkout_url: session.url }),
    };
  } catch (err) {
    console.error("Checkout error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to create checkout session. Please try again." }),
    };
  }
};
