import { isSupportedRoomImageDataUrl, roomImageDataUrlMaxLength } from "../../../api/_imageDataUrl";
import { readOpenAIImagesResponse } from "../../../api/_openAIImagesResponse";
import { consumeRenderRateLimit, getRenderRateLimitKey } from "../../../api/_renderRateLimit";
import { normalizeRenderRequest } from "../../../api/_renderRequest";
import { buildRoomRenderPrompt } from "../../../server/renderPrompt";

function getRuntimeValue(key: string) {
  return process.env[key];
}

function rateLimitHeaders(rateLimit: ReturnType<typeof consumeRenderRateLimit>) {
  return {
    "RateLimit-Limit": String(rateLimit.limit),
    "RateLimit-Remaining": String(rateLimit.remaining),
    "RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  };
}

export async function POST(request: Request) {
  const rateLimit = consumeRenderRateLimit(getRenderRateLimitKey({ headers: request.headers }));
  const headers = rateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many redesign requests. Please wait a few minutes and try again." },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON redesign request." }, { status: 400, headers });
  }

  const payload = body as { imageDataUrl?: unknown };

  if (typeof payload.imageDataUrl !== "string") {
    return Response.json({ error: "Upload a room photo before generating a redesign." }, { status: 400, headers });
  }

  if (payload.imageDataUrl.length > roomImageDataUrlMaxLength) {
    return Response.json({ error: "Room photo is too large. Use an image under 12 MB." }, { status: 413, headers });
  }

  if (!isSupportedRoomImageDataUrl(payload.imageDataUrl)) {
    return Response.json({ error: "Use a JPG, PNG, or WebP room photo." }, { status: 400, headers });
  }

  const renderRequest = normalizeRenderRequest(body);

  if (!renderRequest) {
    return Response.json({ error: "The room brief is incomplete. Check the style, room, budget, and palette." }, { status: 400, headers });
  }

  const apiKey = getRuntimeValue("OPENAI_API_KEY");

  if (!apiKey) {
    return Response.json(
      { error: "Demo shopping plan ready. Add OPENAI_API_KEY in Sites to enable live image generation." },
      { status: 503, headers },
    );
  }

  const imageModel = getRuntimeValue("OPENAI_IMAGE_MODEL") ?? "gpt-image-2";
  const prompt = buildRoomRenderPrompt(renderRequest.preferences, renderRequest.concept);
  const imageRequestBody: Record<string, unknown> = {
    model: imageModel,
    images: [{ image_url: payload.imageDataUrl }],
    prompt,
    output_format: "webp",
    quality: "medium",
    size: "1536x1024",
    n: 1,
  };

  if (imageModel !== "gpt-image-2") {
    imageRequestBody.input_fidelity = "high";
  }

  const openAIResponse = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(imageRequestBody),
  });

  const openAIResult = await readOpenAIImagesResponse(openAIResponse);

  if (!openAIResponse.ok) {
    return Response.json(
      { error: openAIResult.error?.message ?? "Image generation failed. Please try again." },
      { status: openAIResponse.status, headers },
    );
  }

  const imageBase64 = openAIResult.data?.[0]?.b64_json;

  if (!imageBase64) {
    return Response.json({ error: "Image generation did not return an image." }, { status: 502, headers });
  }

  return Response.json(
    {
      imageUrl: `data:image/webp;base64,${imageBase64}`,
      model: imageModel,
      prompt,
      createdAt: new Date().toISOString(),
    },
    { headers },
  );
}
