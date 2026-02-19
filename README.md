# KP Pesach Order Form

Next.js full-stack order form for KP Pesach grocery orders, hosted on Vercel with a public GitHub repository.

## Features

- Excel catalog parsing from `data/KP Pesach List 5786.xlsx`
- Category-based product display with quantity controls
- Product search
- Delivery date + AM/PM selection
- Required contact details with optional customer email
- Server-side order validation (`zod`)
- SMTP order email to store
- Optional customer confirmation email
- Google Sheets logging for all successful orders
- Basic in-memory rate limiting on order submission
- Vercel Web Analytics support (`@vercel/analytics`)

## Tech Stack

- Next.js (App Router, TypeScript)
- `xlsx` for catalog parsing
- `nodemailer` for SMTP
- `googleapis` for Sheets
- `@vercel/analytics` for Vercel analytics
- `vitest` for unit/API-oriented tests

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
cp .env.example .env.local
```

3. Fill all required env vars in `.env.local`.

4. Run development server:

```bash
npm run dev
```

## Catalog Update Workflow

1. Replace `data/KP Pesach List 5786.xlsx` with latest catalog.
2. Commit and push to `main`.
3. Vercel redeploys automatically.

## Tests

Run:

```bash
npm run test
```
