import { buildRoomRenderPrompt } from "../server/renderPrompt";
import type { ProjectPreferences, RoomConcept } from "../src/types";

const openAIBaseUrl = "https://api.openai.com/v1";

interface OpenAIImagesResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    response.status(503).json({
      error: "OpenAI API key is not configured. Add OPENAI_API_KEY in Vercel project settings.",
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

    response.status(200).json({
      imageUrl: `data:image/webp;base64,${b64}`,
      model: imageModel,
      prompt,
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected image generation error.",
    });
  }
}
