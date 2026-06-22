# Roomwise MVP

Roomwise is a web-first interior design MVP. A user can sign in, create a room project, upload or capture a room photo, set a budget, style, palette, and location, then generate an AI room render and a budget-aware shopping list.

## What Works

- Account-gated onboarding with project setup, photo consent, room photo upload, and bundled bedroom test photo.
- Mobile camera capture when the app is opened on a phone; desktop QR handoff when the user is on a larger screen.
- Live OpenAI image rendering through a local Express API.
- Style, palette, budget, room type, and location controls.
- Local product matching, totals, swapping, removal, restore, and share-list formatting.
- Responsive React/Vite interface for desktop and mobile.

## Setup

```bash
npm install
cp .env.example .env.local
```

Add your OpenAI and Supabase client settings to `.env.local`:

```bash
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_IMAGE_MODEL=gpt-image-2
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

Do not expose the OpenAI key through Vite client variables. The OpenAI key is read only by the local API server. The Supabase anon key is intentionally client-side and must be paired with the RLS policies in `docs/supabase-onboarding.sql`.

## Scripts

```bash
npm run dev
npm test
npm run build
```

`npm run dev` starts both:

- Web app: `http://127.0.0.1:5173`
- Local API: `http://127.0.0.1:8787`

## Integration Notes

OpenAI image generation is live when `OPENAI_API_KEY` is configured. Supabase Auth, project persistence, and private room-photo storage are live when `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the schema in `docs/supabase-onboarding.sql` are configured. Retailer inventory and checkout are still mocked through `src/data/catalog.ts`; production should use affiliate feeds or official product APIs where available.
