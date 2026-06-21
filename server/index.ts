import dotenv from "dotenv";
import express from "express";
import {
  captureMaxImageDataUrlLength,
  consumeCaptureRecord,
  isValidCaptureImageDataUrl,
  isValidCaptureSessionId,
  saveCaptureRecord,
} from "../api/_captureStore";
import { isSupportedRoomImageDataUrl, roomImageDataUrlMaxLength } from "../api/_imageDataUrl";
import { readOpenAIImagesResponse } from "../api/_openAIImagesResponse";
import { setNoStoreCacheHeaders } from "../api/_privacyHeaders";
import { consumeRenderRateLimit, getRenderRateLimitKey } from "../api/_renderRateLimit";
import { normalizeRenderRequest } from "../api/_renderRequest";
import { buildRoomRenderPrompt } from "./renderPrompt";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8787);
const openAIBaseUrl = "https://api.openai.com/v1";

app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_request, response) => {
  setNoStoreCacheHeaders(response);

  response.json({
    ok: true,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    mode: process.env.OPENAI_API_KEY ? "live" : "demo",
  });
});

app.get("/api/capture-sessions/:sessionId", (request, response) => {
  setNoStoreCacheHeaders(response);

  const { sessionId } = request.params;

  if (!isValidCaptureSessionId(sessionId)) {
    response.status(400).json({ error: "Invalid sessionId." });
    return;
  }

  response.json({
    ok: true,
    capture: consumeCaptureRecord(sessionId),
  });
});

function handleCapturePhotoPost(request: express.Request, response: express.Response) {
  const sessionId = String(request.params.sessionId ?? "");
  const body = request.body as {
    imageDataUrl?: string;
    name?: string;
    type?: string;
    size?: number;
  } | undefined;

  if (!isValidCaptureSessionId(sessionId)) {
    response.status(400).json({ error: "Invalid sessionId." });
    return;
  }

  if (!body?.imageDataUrl) {
    response.status(400).json({ error: "Missing imageDataUrl." });
    return;
  }

  if (body.imageDataUrl.length > captureMaxImageDataUrlLength) {
    response.status(413).json({ error: "Room photo is too large. Please upload a smaller JPG, PNG, or WebP image." });
    return;
  }

  if (!isValidCaptureImageDataUrl(body.imageDataUrl)) {
    response.status(400).json({ error: "Invalid imageDataUrl. Please upload a JPG, PNG, or WebP image." });
    return;
  }

  saveCaptureRecord(sessionId, {
    imageDataUrl: body.imageDataUrl,
    name: body.name ?? "Phone room photo",
    type: body.type ?? "image/jpeg",
    size: body.size ?? 0,
  });

  response.json({ ok: true });
}

app.post("/api/capture-sessions/:sessionId", (request, response) => {
  setNoStoreCacheHeaders(response);
  handleCapturePhotoPost(request, response);
});

app.post("/api/capture-sessions/:sessionId/photo", (request, response) => {
  setNoStoreCacheHeaders(response);
  handleCapturePhotoPost(request, response);
});

app.post("/api/generate-room-render", async (request, response) => {
  setNoStoreCacheHeaders(response);

  const body = request.body as {
    imageDataUrl?: string;
  } | undefined;

  if (!body?.imageDataUrl) {
    response.status(400).json({
      error: "Missing imageDataUrl.",
    });
    return;
  }

  if (body.imageDataUrl.length > roomImageDataUrlMaxLength) {
    response.status(413).json({
      error: "Room photo is too large. Please upload a smaller JPG, PNG, or WebP image.",
    });
    return;
  }

  if (!isSupportedRoomImageDataUrl(body.imageDataUrl)) {
    response.status(400).json({
      error: "Invalid imageDataUrl. Please upload a JPG, PNG, or WebP image.",
    });
    return;
  }

  const renderRequest = normalizeRenderRequest(request.body);

  if (!renderRequest) {
    response.status(400).json({
      error: "Invalid room preferences or design concept.",
    });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    response.status(503).json({
      error: "OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server.",
    });
    return;
  }

  const rateLimit = consumeRenderRateLimit(getRenderRateLimitKey(request));
  response.setHeader("X-RateLimit-Limit", String(rateLimit.limit));
  response.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
  response.setHeader("X-RateLimit-Reset", String(Math.ceil(rateLimit.resetAt / 1000)));

  if (!rateLimit.allowed) {
    response.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    response.status(429).json({
      error: "Too many render requests. Please wait before generating another redesign.",
    });
    return;
  }

  const imageModel = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const prompt = buildRoomRenderPrompt(renderRequest.preferences, renderRequest.concept);
  const imageRequestBody: Record<string, unknown> = {
    model: imageModel,
    images: [{ image_url: body.imageDataUrl }],
    prompt,
    output_format: "webp",
    quality: "medium",
    size: "1536x1024",
    n: 1,
  };

  if (imageModel !== "gpt-image-2") {
    imageRequestBody.input_fidelity = "high";
  }

  try {
    const openAIResponse = await fetch(`${openAIBaseUrl}/images/edits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(imageRequestBody),
    });

    const payload = await readOpenAIImagesResponse(openAIResponse);

    if (!openAIResponse.ok) {
      response.status(openAIResponse.status).json({
        error: payload?.error?.message ?? "OpenAI image generation failed.",
      });
      return;
    }

    const b64 = payload?.data?.[0]?.b64_json;

    if (!b64) {
      response.status(502).json({
        error: "OpenAI returned no image data.",
      });
      return;
    }

    response.json({
      imageUrl: `data:image/webp;base64,${b64}`,
      model: imageModel,
      prompt,
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected image generation error.",
    });
  }
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Roomwise API listening on http://127.0.0.1:${port}`);
});
