# Roomwise Integrations

Roomwise is wired for live OpenAI image edits through a local server endpoint. Retailer data still uses a local sample catalog for the MVP.

## Current State

- Uploaded room photos preview locally in the browser and are sent to the local API only when a render is requested.
- `POST /api/generate-room-render` calls the OpenAI Images API from `server/index.ts`.
- `OPENAI_API_KEY` stays server-side in `.env.local` and is never exposed through Vite client env vars.
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

3. Persistence
   - Store uploaded room assets, generated renders, selected products, and shopping-list history.
   - Track image generation costs and request metadata per project.

## Environment Variables

```bash
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_IMAGE_MODEL=gpt-image-2
```

Do not expose this key through Vite client env variables.
