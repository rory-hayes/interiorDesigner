# Roomwise MVP

Roomwise is a web-first interior design MVP. A user can load a room photo, set a budget, style, palette, and location, then generate an AI room render and a budget-aware shopping list.

## What Works

- Room photo upload and bundled bedroom test photo.
- Live OpenAI image rendering through a local Express API.
- Style, palette, budget, room type, and location controls.
- Local product matching, totals, swapping, removal, restore, and share-list formatting.
- Responsive React/Vite interface for desktop and mobile.

## Setup

```bash
npm install
cp .env.example .env.local
```

Add your OpenAI key to `.env.local`:

```bash
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_IMAGE_MODEL=gpt-image-2
```

Do not expose the key through Vite client variables. The key is read only by the local API server.

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

OpenAI image generation is live when `OPENAI_API_KEY` is configured. Retailer inventory and checkout are still mocked through `src/data/catalog.ts`; production should use affiliate feeds or official product APIs where available.
