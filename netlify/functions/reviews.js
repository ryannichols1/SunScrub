// netlify/functions/reviews.js
// GET  → returns all approved reviews
// POST → submits a new review (saved to Netlify Blobs or a simple JSON store)
//
// For production, you'd want to use a database (Supabase, PlanetScale, etc.)
// This version uses Netlify Blobs for zero-config persistence.

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const store = getStore("reviews");

  // --- GET: return all reviews ---
  if (event.httpMethod === "GET") {
    try {
      const data = await store.get("all-reviews");
      const reviews = data ? JSON.parse(data) : [];
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviews),
      };
    } catch (err) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([]),
      };
    }
  }

  // --- POST: submit a new review ---
  if (event.httpMethod === "POST") {
    try {
      const { name, area, text, stars } = JSON.parse(event.body);

      if (!name || !text || !stars || stars < 1 || stars > 5) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Missing or invalid fields: name, text, stars (1-5)" }),
        };
      }

      // Get existing reviews
      let reviews = [];
      try {
        const data = await store.get("all-reviews");
        if (data) reviews = JSON.parse(data);
      } catch (e) { /* empty store */ }

      // Add new review
      const review = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name.trim(),
        area: (area || "").trim(),
        text: text.trim(),
        stars: parseInt(stars),
        created_at: new Date().toISOString(),
      };
      reviews.unshift(review);

      // Save
      await store.set("all-reviews", JSON.stringify(reviews));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, review }),
      };
    } catch (err) {
      console.error("Review submit error:", err);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to save review" }),
      };
    }
  }

  return { statusCode: 405, body: "Method not allowed" };
};
