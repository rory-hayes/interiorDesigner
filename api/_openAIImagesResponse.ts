export interface OpenAIImagesResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

export async function readOpenAIImagesResponse(response: Pick<Response, "text">): Promise<OpenAIImagesResponse> {
  const text = await response.text();

  try {
    return JSON.parse(text) as OpenAIImagesResponse;
  } catch {
    return {
      error: {
        message: text.trim().slice(0, 240) || "OpenAI returned a non-JSON response.",
      },
    };
  }
}
