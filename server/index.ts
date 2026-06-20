import dotenv from "dotenv";
import express from "express";
import { isSupportedRoomImageDataUrl, roomImageDataUrlMaxLength } from "../api/_imageDataUrl";
import { buildRoomRenderPrompt } from "./renderPrompt";
import type { ProjectPreferences, RoomConcept } from "../src/types";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8787);
const openAIBaseUrl = "https://api.openai.com/v1";
const captureSessions = new Map<
  string,
  {
    imageDataUrl: string;
    name: string;
    type: string;
    size: number;
    uploadedAt: string;
  }
>();

app.use(express.json({ limit: "25mb" }));

interface OpenAIImagesResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    mode: process.env.OPENAI_API_KEY ? "live" : "demo",
  });
});

app.get("/api/capture-sessions/:sessionId", (request, response) => {
  const capture = captureSessions.get(request.params.sessionId);

  response.json({
    ok: true,
    capture: capture ?? null,
  });
});

app.post("/api/capture-sessions/:sessionId/photo", (request, response) => {
  const body = request.body as {
    imageDataUrl?: string;
    name?: string;
    type?: string;
    size?: number;
  };

  if (!body.imageDataUrl) {
    response.status(400).json({ error: "Missing imageDataUrl." });
    return;
  }

  if (body.imageDataUrl.length > roomImageDataUrlMaxLength) {
    response.status(413).json({ error: "Room photo is too large. Please upload a smaller JPG, PNG, or WebP image." });
    return;
  }

  if (!isSupportedRoomImageDataUrl(body.imageDataUrl)) {
    response.status(400).json({ error: "Invalid imageDataUrl. Please upload a JPG, PNG, or WebP image." });
    return;
  }

  captureSessions.set(request.params.sessionId, {
    imageDataUrl: body.imageDataUrl,
    name: body.name ?? "Phone room photo",
    type: body.type ?? "image/jpeg",
    size: body.size ?? 0,
    uploadedAt: new Date().toISOString(),
  });

  response.json({ ok: true });
});

app.post("/api/generate-room-render", async (request, response) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    response.status(503).json({
      error: "OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server.",
    });
    return;
  }

  const body = request.body as {
    imageDataUrl?: string;
    preferences?: ProjectPreferences;
    concept?: Pick<RoomConcept, "name" | "summary">;
  };

  if (!body.imageDataUrl || !body.preferences || !body.concept) {
    response.status(400).json({
      error: "Missing imageDataUrl, preferences, or concept.",
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

  const imageModel = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const prompt = buildRoomRenderPrompt(body.preferences, body.concept);
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

    const payload = (await openAIResponse.json()) as OpenAIImagesResponse;

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
