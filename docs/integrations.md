# Roomwise Integrations

Roomwise is wired for live OpenAI image edits through a server endpoint and Supabase-backed auth/project/photo persistence. Retailer data still uses a local sample catalog for the MVP.

## Current State

- Uploaded room photos preview locally in the browser and are sent to the local API only when a render is requested.
- `POST /api/generate-room-render` calls the OpenAI Images API from `server/index.ts`.
- `OPENAI_API_KEY` stays server-side in `.env.local` and is never exposed through Vite client env vars.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` enable Google OAuth, email magic links, project reads/writes, and private room-photo uploads from the browser.
- The production CSP allows Supabase `connect-src` origins and the app relies on RLS policies from `docs/supabase-onboarding.sql`.
- Product matching uses the local sample catalog in `src/data/catalog.ts`.
- The shopping list uses placeholder retailer URLs and is not connected to live checkout yet.

## Required Real Integrations

1. Product feed backend
   - Replace `src/data/catalog.ts` with normalized product records from affiliate/product feeds.
   - Keep a common product shape: name, retailer, price, dimensions, image, URL, availability, category, style tags.
   - Prefer official affiliate/product feeds over crawling pages.

2. Shopping/checkout
   - Start with affiliate deep links.
   - Move to cart/checkout only where a retailer or commerce partner supports it.

3. Persistence hardening
   - Apply `docs/supabase-onboarding.sql`.
   - Store generated renders, selected products, and shopping-list history after render generation.
   - Track image generation costs and request metadata per project.

## Environment Variables

```bash
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_IMAGE_MODEL=gpt-image-2
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

Do not expose the OpenAI key through Vite client env variables. Supabase anon keys are safe to expose only with RLS enabled and storage buckets private.
