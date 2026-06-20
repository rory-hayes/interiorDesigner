# Roomwise Production Readiness

This checklist tracks what is needed to move the current deployed Roomwise beta from demo-ready to sellable customer use.

## Current Live State

- Production URL: https://interior-designer-nu.vercel.app/
- Vercel project: `interior-designer`
- Current branch: `codex/roomwise-mvp`
- The UI, upload flow, QR phone-capture path, shopping-plan interface, and demo-mode API health route are deployed.
- `/api/health` currently reports `mode: "demo"` until `OPENAI_API_KEY` is configured in Vercel.

## Required Before Selling

1. Configure OpenAI in Vercel
   - Add `OPENAI_API_KEY` as a production environment variable.
   - Optional: add `OPENAI_IMAGE_MODEL`; default is `gpt-image-2`.
   - Redeploy after adding the env vars.
   - Verify `/api/health` returns `mode: "live"`.

2. Verify real image generation
   - Upload a room photo.
   - Run `Generate redesign`.
   - Confirm an after image appears and the shopping list is still generated.
   - Check Vercel runtime logs for OpenAI errors, payload-size failures, or timeouts.

3. Replace volatile phone-capture storage
   - Current phone capture uses in-memory serverless storage.
   - This is acceptable for a demo but not reliable across serverless instances or cold starts.
   - Production should use persistent storage such as Vercel Blob, S3, Supabase Storage, or a database-backed asset table.

4. Add account and project persistence
   - Save user projects, uploaded images, generated renders, selected shopping lists, and timestamps.
   - Avoid storing customer room photos only in browser memory.
   - Add deletion/export controls before taking real customers.

5. Add real product data
   - Current product links are placeholder retailer examples.
   - Replace `src/data/catalog.ts` with affiliate feeds or official retailer APIs.
   - Track availability, region, price, product image, dimensions, category, and affiliate URL.

6. Add commercial basics
   - Privacy policy and terms.
   - Photo-upload consent language.
   - Support/contact path.
   - Analytics for funnel drop-off and generation failures.
   - Cost tracking per render.

## Verification Checklist

- Desktop viewport loads without document scroll.
- Mobile viewport loads without document scroll.
- Phone capture page opens from QR link.
- `/api/health` returns 200.
- `/api/capture-sessions/test-session` returns 200.
- `/api/generate-room-render` returns 503 in demo mode and succeeds in live mode.
- Vercel production deployment is `READY` after every push.

## Known Limitation

The deployed app is usable as a polished beta shell today, but it is not ready to sell until the OpenAI key is configured and persistent storage replaces the in-memory capture bridge.
