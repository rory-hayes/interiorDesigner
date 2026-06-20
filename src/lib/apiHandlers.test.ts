import { describe, expect, it } from "vitest";
import generateRoomRenderHandler from "../../api/generate-room-render";
import healthHandler from "../../api/health";
import { noStoreCacheControl } from "../../api/_privacyHeaders";

function createJsonResponse() {
  return {
    headers: new Map<string, string>(),
    statusCode: 200,
    payload: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers.set(name, value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

describe("API handlers", () => {
  it("rejects non-GET health checks with method metadata", () => {
    const response = createJsonResponse();

    healthHandler({ method: "POST" }, response);

    expect(response.statusCode).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(response.headers.get("Cache-Control")).toBe(noStoreCacheControl);
    expect(response.payload).toEqual({ error: "Method not allowed." });
  });

  it("returns a controlled render error when the POST body is missing", async () => {
    const response = createJsonResponse();

    await generateRoomRenderHandler({ method: "POST", body: undefined }, response);

    expect(response.statusCode).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe(noStoreCacheControl);
    expect(response.payload).toEqual({ error: "Missing imageDataUrl." });
  });
});
