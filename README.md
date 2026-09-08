# 🌾 AgriChain Connect


**A B2B digital marketplace and supply chain platform for agriculture** — connecting Farmers, Local Aggregators, Wholesalers, Manufacturers/Processors, Distributors, and Final Retailers in one system, with role-specific dashboards, negotiated trading, escrow/UPI/cash payments, a trust scoring engine, and AI-assisted route optimization.

Full product spec: [`AgriChain_Connect_PRD.docx`](./AgriChain_Connect_PRD.docx) (also available as plain text in [`PRD_extracted.txt`](./PRD_extracted.txt)).

---

## The Problem

A crop typically passes through six hands before reaching a consumer — Farmer → Local Aggregator → Wholesaler → Processor → Distributor → Retailer — with the upstream seller (usually the farmer) having little visibility into fair pricing, few alternative buyers, and no reliable way to know which counterparties can be trusted with payment or fulfillment.

## The Solution

AgriChain Connect digitizes this chain into a single platform where:

- Every one of the six supply chain roles gets a **purpose-built interface** matching how they actually trade (sell-only, buy-only, or buy-and-sell).
- Every transaction can be **negotiated** via a structured counter-offer system instead of a flat take-it-or-leave-it price.
- Every user has a **Trust Score** computed from real payment, fulfillment, punctuality, and peer-review data.
- An **AI Route Optimization Engine** can recommend skipping a low-trust or below-market intermediary tier entirely, routing a sale directly to a healthier node further down the chain.
- Payments run through **escrow, UPI/bank transfer, or logged cash**, with dual confirmation for cash to prevent disputes.
- A **₹100 value-distribution panel**, backed by one shared dataset, shows every role exactly how a consumer's rupee is split across the chain.
- The whole app supports **English, Hindi, Punjabi, and Marathi** from the ground up.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js, Express 5 |
| Database | PostgreSQL (via [InsForge](https://insforge.dev) / Supabase) |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` password hashing |
| Frontend | Vanilla JS (component/view-based), HTML, CSS — no framework build step |
| Deployment | Vercel (serverless API entrypoint + static frontend) |
| Testing | Custom Node-based test suite + a Bruno/Postman collection |

---

## Project Structure

```
AgriChainConnect/
├── api/
│   └── index.js              # Vercel serverless entrypoint (wraps the Express app)
├── server/
│   ├── index.js               # Express app: middleware, route mounting, health check
│   ├── config/
│   │   ├── db.js              # PostgreSQL connection
│   │   └── supabase.js        # Supabase client config
│   ├── constants/
│   │   ├── roles.js           # Controlled role enum + buy/sell capability matrix (PRD §3, §4, §11.5)
│   │   └── localization.js    # Supported languages / localized string handling (PRD §7)
│   ├── middleware/
│   │   ├── auth.js            # JWT verification
│   │   ├── roleGuard.js       # Server-side buy/sell capability enforcement (PRD §11.4)
│   │   ├── rateLimiter.js     # Login & negotiation rate limiting
│   │   └── errorHandler.js    # Centralized error handling
│   ├── routes/                 # One file per API resource (see API Overview below)
│   └── services/
│       ├── discovery.service.js         # Adaptive Nearby Member Discovery (PRD §10)
│       ├── routeOptimization.service.js # AI Route Optimization Engine (PRD §8)
│       ├── trustScore.service.js        # Trust Score calculation engine (PRD §9)
│       └── payment.service.js           # Escrow / UPI / cash payment logic (PRD §5)
├── migrations/
│   └── ..._init-agrichain-schema.sql   # Full Postgres schema — see Data Model below
├── public/
│   ├── index.html
│   ├── js/
│   │   ├── app.js, api.js, state.js, i18n.js
│   │   ├── views/              # onboardingView.js, dashboardViews.js (role-specific dashboards)
│   │   └── components/         # sharedComponents.js (negotiation, wallet, order tracker, etc.)
│   └── styles/                 # main, onboarding, dashboard, components CSS
├── tests/
│   ├── test_suite.js                    # `npm test` — full backend test suite
│   ├── agrichain_api_collection.json    # Bruno/Postman collection
│   ├── frontend_backend_e2e_verify.js
│   ├── production_e2e_verify.js
│   └── security_regression_test.js / production_security_test.js
├── AGENTS.md                  # InsForge backend + AI coding agent context
├── vercel.json                 # Vercel routing config
└── .env.example                 # Environment variable template
```

---

## Data Model

The Postgres schema (see [`migrations/`](./migrations)) implements:

`users` · `listings` · `stock_pools` · `negotiation_threads` · `negotiation_offers` · `orders` · `order_status_history` · `payments` · `escrow_events` · `trust_scores` · `trust_score_history` · `peer_reviews` · `market_index_prices` · `route_recommendations` · `value_distributions`

The `users.role` field is a controlled enum (`farmer`, `local_aggregator`, `wholesaler`, `manufacturer`, `distributor`, `final_retailer`) — never free text — and is the backend's single source of truth for what a given account is permitted to do (see **Role Model** below).

---

## Role Model

| Role | Buys | Sells | Notes |
|---|:---:|:---:|---|
| Farmer | ❌ | ✅ | Sell-only |
| Local Aggregator | ✅ | ✅ | Dual-sided |
| Wholesaler | ✅ | ✅ | Dual-sided |
| Manufacturer (Processor) | ✅ | ✅ | Dual-sided |
| Distributor | ✅ | ✅ | Dual-sided |
| Final Retailer | ✅ | ❌ | Buy-only |

Buy/sell capability is enforced **server-side** in `roleGuard.js` via `requireBuyCapability` / `requireSellCapability` middleware — a Farmer account cannot successfully call a buy-side endpoint regardless of what the frontend sends, per the security requirement in PRD §11.4.

---

## API Overview

All endpoints are mounted under `/api`. Full request/response contracts are in the Bruno/Postman collection at [`tests/agrichain_api_collection.json`](./tests/agrichain_api_collection.json).

| Resource | Base path | Covers |
|---|---|---|
| Auth | `/api/auth` | Register, login, `GET /me` |
| User | `/api/user` | Profile, language preference |
| Listings | `/api/listings` | CRUD listings, stock pooling (Aggregator) |
| Negotiations | `/api/negotiations` | Threaded offers, counter-offers, accept/reject |
| Orders | `/api/orders` | Order creation & retrieval |
| Order Status | `/api/orders/:id/status(-history)` | Six-stage order tracking (PRD §12) |
| Payments | `/api/payments` | Escrow release/dispute, cash log/confirm, UPI record |
| Trust Score | `/api/trust-score` | Own/other scores, peer reviews |
| Routes | `/api/routes/recommendations` | AI Route Optimization output |
| Discovery | `/api/discovery/nearby` | Adaptive Nearby Member Discovery |
| Value Distribution | `/api/value-distribution` | ₹100 breakdown dataset |
| Market Prices | `/api/market-prices` | Live market index price |

Health check: `GET /api/health` — verifies API and database connectivity.

---

## Getting Started

### Prerequisites

- Node.js (LTS)
- A PostgreSQL database — either via [InsForge](https://insforge.dev) or Supabase

### 1. Clone & install

```bash
git clone <this-repo-url>
cd AgriChainConnect
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env` with real values — see [`.env.example`](./.env.example) for the full list, including:

- `DATABASE_URL`, `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, or `INSFORGE_URL` / `INSFORGE_ANON_KEY` / `INSFORGE_API_KEY`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `PAYMENT_GATEWAY_PROVIDER`, `PAYMENT_GATEWAY_KEY_ID`, `PAYMENT_GATEWAY_KEY_SECRET`, `ESCROW_INSPECTION_WINDOW_HOURS`
- `MARKET_DATA_PROVIDER`, `MARKET_DATA_API_KEY`, `MARKET_DATA_API_URL`
- `DEFAULT_SEARCH_RADIUS_KM`, `EXPANSION_STEPS_KM`

**Never commit `.env`** — it's already covered by `.gitignore`.

### 3. Run database migrations

Apply [`migrations/..._init-agrichain-schema.sql`](./migrations) to your Postgres database (via the InsForge CLI, Supabase SQL editor, or `psql`, depending on which backend you're using).

### 4. Start the server

```bash
npm run dev
```

The app serves both the API and the static frontend from the same Express server, by default at `http://localhost:5000`.

### 5. Verify it's running

```bash
curl http://localhost:5000/api/health
```

---

## Testing

```bash
npm test
```

Runs the full backend test suite (`tests/test_suite.js`) against a local server instance, covering positive/negative cases, role-based authorization, and database CRUD.

Additional test scripts:

| File | Purpose |
|---|---|
| `tests/agrichain_api_collection.json` | Import into Bruno or Postman for manual/exploratory API testing |
| `tests/frontend_backend_e2e_verify.js` | End-to-end frontend↔backend flow checks |
| `tests/security_regression_test.js` | Auth, RLS, and cross-role data-isolation regression checks |
| `tests/production_e2e_verify.js` / `production_security_test.js` | Run against a deployed URL post-launch |

---

## Deployment

Configured for **Vercel**: [`vercel.json`](./vercel.json) routes `/api/*` to the serverless entrypoint at `api/index.js` and all other paths to the static frontend (`public/index.html`).

Before deploying:
1. Set all variables from `.env.example` in the Vercel project's Environment Variables settings.
2. Point `DATABASE_URL` / `SUPABASE_*` / `INSFORGE_*` at your **production** database — not local/dev.
3. Run `tests/production_e2e_verify.js` and `tests/production_security_test.js` against the deployed URL before treating it as demo-ready.

---

## Backend-as-a-Service: InsForge

This project uses [InsForge](https://insforge.dev) — Project **AgriChain6UI** — for Postgres, auth, and related backend infrastructure. See [`AGENTS.md`](./AGENTS.md) for InsForge-specific conventions (e.g., array-based inserts, `auth.uid()` in RLS policies) used throughout this codebase.

---

## Documentation

- [`AgriChain_Connect_PRD.docx`](./AgriChain_Connect_PRD.docx) — full Product Requirements Document (roles, payments, Trust Score, AI routing spec, onboarding, order tracking, roadmap)
- [`PRD_extracted.txt`](./PRD_extracted.txt) — plain-text version of the same PRD, convenient for quick searches or feeding to AI coding tools
- [`AGENTS.md`](./AGENTS.md) — context and conventions for AI coding agents working in this repo

---

## License

ISC (see `package.json`). Update as appropriate for your team/hackathon submission.
