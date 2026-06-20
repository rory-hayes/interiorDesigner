import { describe, expect, it } from "vitest";
import { readOpenAIImagesResponse } from "../../api/_openAIImagesResponse";

describe("OpenAI image response parsing", () => {
  it("parses successful image JSON responses", async () => {
    const payload = await readOpenAIImagesResponse({
      text: async () => JSON.stringify({ data: [{ b64_json: "abc123" }] }),
    });

    expect(payload.data?.[0]?.b64_json).toBe("abc123");
  });

  it("turns non-JSON upstream responses into usable error messages", async () => {
    const payload = await readOpenAIImagesResponse({
      text: async () => "Bad Gateway",
    });

    expect(payload.error?.message).toBe("Bad Gateway");
  });
});
