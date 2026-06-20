import { beforeEach, describe, expect, it } from "vitest";
import {
  captureMaxAgeMs,
  captureSessions,
  getCaptureRecord,
  isValidCaptureImageDataUrl,
  isValidCaptureSessionId,
  saveCaptureRecord,
} from "../../api/_captureStore";

describe("capture store", () => {
  beforeEach(() => {
    captureSessions.clear();
  });

  it("validates capture session ids", () => {
    expect(isValidCaptureSessionId("abc123")).toBe(true);
    expect(isValidCaptureSessionId("abc-123-session")).toBe(true);
    expect(isValidCaptureSessionId("short")).toBe(false);
    expect(isValidCaptureSessionId("../abc123")).toBe(false);
  });

  it("validates browser-friendly image data URLs", () => {
    expect(isValidCaptureImageDataUrl("data:image/jpeg;base64,abcd1234+/=")).toBe(true);
    expect(isValidCaptureImageDataUrl("data:image/png;base64,abcd1234")).toBe(true);
    expect(isValidCaptureImageDataUrl("data:image/webp;base64,abcd1234")).toBe(true);
    expect(isValidCaptureImageDataUrl("data:image/gif;base64,abcd1234")).toBe(false);
    expect(isValidCaptureImageDataUrl("https://example.com/photo.jpg")).toBe(false);
  });

  it("expires stale capture records", () => {
    const now = Date.parse("2026-06-20T20:00:00.000Z");

    saveCaptureRecord(
      "session-123",
      {
        imageDataUrl: "data:image/jpeg;base64,abcd1234",
        name: "room.jpg",
        type: "image/jpeg",
        size: 4,
      },
      now,
    );

    expect(getCaptureRecord("session-123", now + captureMaxAgeMs - 1)).not.toBeNull();
    expect(getCaptureRecord("session-123", now + captureMaxAgeMs + 1)).toBeNull();
  });
});
