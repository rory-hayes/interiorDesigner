import { beforeEach, describe, expect, it } from "vitest";
import captureSessionHandler from "../../api/capture-sessions/[sessionId]";
import { captureSessions } from "../../api/_captureStore";
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
  beforeEach(() => {
    captureSessions.clear();
  });

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

  it("stores and consumes phone captures through the canonical session endpoint", () => {
    const projectId = "project_abc123";
    const registerResponse = createJsonResponse();

    captureSessionHandler(
      {
        method: "PUT",
        query: { sessionId: "session-123456" },
        body: {
          projectId,
          ownerId: "user_abc123",
        },
      },
      registerResponse,
    );

    expect(registerResponse.statusCode).toBe(200);
    expect(registerResponse.payload).toEqual({ ok: true });

    const postResponse = createJsonResponse();
    const imageDataUrl = "data:image/jpeg;base64,YWJjZA==";

    captureSessionHandler(
      {
        method: "POST",
        query: { sessionId: "session-123456" },
        body: {
          imageDataUrl,
          name: "phone-room.jpg",
          type: "image/jpeg",
          size: 1234,
          projectId,
        },
      },
      postResponse,
    );

    expect(postResponse.statusCode).toBe(200);
    expect(postResponse.headers.get("Cache-Control")).toBe(noStoreCacheControl);
    expect(postResponse.payload).toEqual({ ok: true });

    const getResponse = createJsonResponse();

    captureSessionHandler(
      {
        method: "GET",
        query: { sessionId: "session-123456", projectId },
      },
      getResponse,
    );

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.payload).toMatchObject({
      ok: true,
      capture: {
        imageDataUrl,
        name: "phone-room.jpg",
        type: "image/jpeg",
        size: 1234,
      },
    });

    const consumedResponse = createJsonResponse();

    captureSessionHandler(
      {
        method: "GET",
        query: { sessionId: "session-123456", projectId },
      },
      consumedResponse,
    );

    expect(consumedResponse.statusCode).toBe(404);
    expect(consumedResponse.payload).toEqual({ ok: false, capture: null, error: "Capture link expired." });
  });

  it("rejects phone captures before the desktop project registers the token", () => {
    const response = createJsonResponse();

    captureSessionHandler(
      {
        method: "POST",
        query: { sessionId: "session-123456" },
        body: {
          imageDataUrl: "data:image/jpeg;base64,YWJjZA==",
          name: "phone-room.jpg",
          type: "image/jpeg",
          size: 1234,
          projectId: "project_abc123",
        },
      },
      response,
    );

    expect(response.statusCode).toBe(403);
    expect(response.payload).toEqual({ error: "Capture link expired. Scan the QR code again." });
  });

  it("rejects phone captures when the QR project does not match the registered project", () => {
    const registerResponse = createJsonResponse();

    captureSessionHandler(
      {
        method: "PUT",
        query: { sessionId: "session-123456" },
        body: {
          projectId: "project_abc123",
          ownerId: "user_abc123",
        },
      },
      registerResponse,
    );

    const postResponse = createJsonResponse();

    captureSessionHandler(
      {
        method: "POST",
        query: { sessionId: "session-123456" },
        body: {
          imageDataUrl: "data:image/jpeg;base64,YWJjZA==",
          name: "phone-room.jpg",
          type: "image/jpeg",
          size: 1234,
          projectId: "project_other",
        },
      },
      postResponse,
    );

    expect(postResponse.statusCode).toBe(403);
    expect(postResponse.payload).toEqual({ error: "Capture link expired. Scan the QR code again." });
  });
});
