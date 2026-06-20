# Roomwise Production Readiness

This checklist tracks what is needed to move the current deployed Roomwise beta from demo-ready to sellable customer use.

## Current Live State

- Production URL: https://interior-designer-nu.vercel.app/
- Vercel project: `interior-designer`
- Current branch: `codex/roomwise-mvp`
- The UI, upload flow, explicit photo consent, QR phone-capture path, shopping-plan interface, workspace persistence, support/legal links, security headers, and demo-mode API health route are deployed.
- A local beta insights panel tracks funnel events and estimated live render spend on the user's device.
- `/api/health` currently reports `mode: "demo"` until `OPENAI_API_KEY` is configured in Vercel.
- Beta privacy and terms pages are available at `/privacy.html` and `/terms.html`.

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
   - Replace `src/data/catalog.ts` with affiliate feeds or official retailer APIs where available.
   - Track availability, region, price, product image, dimensions, category, and affiliate URL.

6. Finish commercial basics
   - Beta privacy policy and terms are now published, but they still need qualified legal review before paid launch.
   - Explicit photo-upload consent is now required before desktop and phone-capture uploads.
   - Support, privacy, and terms links are now available in the app chrome.
   - Local beta analytics and estimated render cost tracking are available in-app.
   - Add server-side/product analytics before paid launch so funnel and failure reporting survives device changes.

## Verification Checklist

- Desktop viewport loads without document scroll.
- Mobile viewport loads without document scroll.
- Desktop photo upload is disabled until photo consent is confirmed.
- Phone-capture photo upload is disabled until photo consent is confirmed.
- App chrome links to support, privacy, and terms.
- App chrome shows local beta insights for runs, failures, photos, and estimated render spend.
- Phone capture page opens from QR link.
- `/privacy.html` returns 200.
- `/terms.html` returns 200.
- `/api/health` returns 200.
- `/api/capture-sessions/test-session` returns 200.
- `/api/generate-room-render` returns 503 in demo mode and succeeds in live mode.
- Vercel production deployment is `READY` after every push.

## Known Limitation

The deployed app is usable as a polished beta shell today, but it is not ready to sell until the OpenAI key is configured and persistent storage replaces the in-memory capture bridge.
