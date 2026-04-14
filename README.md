# SunScrub — Solar Panel Cleaning Dublin

Full-stack landing page with Stripe payments, deployed on Netlify.

## Project Structure

```
sunscrub-netlify/
├── public/
│   └── index.html                        # Landing page
├── netlify/
│   └── functions/
│       ├── create-checkout.js            # Stripe Checkout session
│       ├── stripe-webhook.js             # Payment confirmation
│       └── reviews.js                    # Submit & retrieve reviews
├── netlify.toml                          # Netlify config
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Setup

### 1. Push to GitHub

```bash
cd sunscrub-netlify
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### 2. Deploy on Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site** → **Import an existing project**
3. Connect your GitHub repo
4. Build settings will auto-detect from `netlify.toml`:
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
5. Click **Deploy**

### 3. Add Environment Variables

In Netlify: **Site configuration** → **Environment variables** → Add:

| Variable               | Value                          |
|------------------------|-------------------------------|
| `STRIPE_SECRET_KEY`    | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET`| `whsec_...`                    |

Get these from [dashboard.stripe.com](https://dashboard.stripe.com):
- **API Keys**: Developers → API Keys
- **Webhook Secret**: See step 4 below

### 4. Set Up Stripe Webhook

1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. URL: `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`
4. Events to listen for:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copy the **Signing secret** → paste as `STRIPE_WEBHOOK_SECRET` in Netlify

### 5. Redeploy

After adding env vars, trigger a redeploy:
**Deploys** → **Trigger deploy** → **Deploy site**

## How It Works

1. Customer uses the calculator to see their price (€39 callout + €7/panel)
2. Clicks **Book Now** → modal collects name, email, phone, address
3. Customer confirms → frontend calls `/.netlify/functions/create-checkout`
4. Function creates a Stripe customer + Checkout Session
5. Customer is redirected to Stripe's hosted payment page
6. After paying → redirected back with `?success=true` → success banner shown
7. Stripe webhook fires → `stripe-webhook` function logs the confirmed payment

## Reviews

Reviews are stored using Netlify Blobs (zero-config persistence):
- `GET /.netlify/functions/reviews` → returns all reviews
- `POST /.netlify/functions/reviews` → submits a new review

Reviews persist across deploys — no database needed.

## Test Cards (Stripe Test Mode)

| Number               | Result             |
|---------------------|-------------------|
| 4242 4242 4242 4242 | Success            |
| 4000 0000 0000 9995 | Declined           |
| 4000 0025 0000 3155 | 3D Secure required |

Any future expiry date, any 3-digit CVC.

## Going Live

1. Switch `STRIPE_SECRET_KEY` from `sk_test_...` to `sk_live_...`
2. Create a new live webhook endpoint in Stripe
3. Update `STRIPE_WEBHOOK_SECRET` with the live signing secret
4. Add your custom domain in Netlify: **Site configuration** → **Domain management**
