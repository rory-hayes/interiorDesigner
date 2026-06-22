import { beforeEach, describe, expect, it } from "vitest";
import {
  captureMaxAgeMs,
  captureMaxSessions,
  captureTokenMaxAgeMs,
  captureSessions,
  consumeCaptureRecord,
  getCaptureRecord,
  getCaptureSession,
  isCaptureSessionReady,
  isValidCaptureImageDataUrl,
  isValidCaptureProjectId,
  isValidCaptureSessionId,
  registerCaptureSession,
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

  it("validates project-bound capture ids", () => {
    expect(isValidCaptureProjectId("project_abc-123")).toBe(true);
    expect(isValidCaptureProjectId("d7c7bd4a-604b-4637-aaf7-6efc8162832d")).toBe(true);
    expect(isValidCaptureProjectId("bad path")).toBe(false);
    expect(isValidCaptureProjectId("../project_abc123")).toBe(false);
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
    const projectId = "project_abc123";

    registerCaptureSession("session-123", { projectId }, now);

    saveCaptureRecord(
      "session-123",
      projectId,
      {
        imageDataUrl: "data:image/jpeg;base64,abcd1234",
        name: "room.jpg",
        type: "image/jpeg",
        size: 4,
      },
      now,
    );

    expect(getCaptureRecord("session-123", projectId, now + captureMaxAgeMs - 1)).not.toBeNull();
    expect(getCaptureRecord("session-123", projectId, now + captureMaxAgeMs + 1)).toBeNull();
  });

  it("expires unused capture tokens before a phone can upload", () => {
    const now = Date.parse("2026-06-20T20:00:00.000Z");
    const projectId = "project_abc123";

    registerCaptureSession("session-123", { projectId }, now);

    expect(isCaptureSessionReady("session-123", projectId, now + captureTokenMaxAgeMs - 1)).toBe(true);
    expect(isCaptureSessionReady("session-123", projectId, now + captureTokenMaxAgeMs + 1)).toBe(false);
    expect(getCaptureSession("session-123", now + captureTokenMaxAgeMs + 1)).toBeNull();
  });

  it("rejects captures that are not registered for the project", () => {
    const now = Date.parse("2026-06-20T20:00:00.000Z");

    registerCaptureSession("session-123", { projectId: "project_abc123" }, now);

    expect(
      saveCaptureRecord(
        "session-123",
        "project_wrong",
        {
          imageDataUrl: "data:image/jpeg;base64,abcd1234",
          name: "room.jpg",
          type: "image/jpeg",
          size: 4,
        },
        now,
      ),
    ).toBe(false);
    expect(getCaptureRecord("session-123", "project_abc123", now)).toBeNull();
  });

  it("consumes capture records after first desktop read", () => {
    const now = Date.parse("2026-06-20T20:00:00.000Z");
    const projectId = "project_abc123";

    registerCaptureSession("session-123", { projectId }, now);

    saveCaptureRecord(
      "session-123",
      projectId,
      {
        imageDataUrl: "data:image/jpeg;base64,abcd1234",
        name: "room.jpg",
        type: "image/jpeg",
        size: 4,
      },
      now,
    );

    expect(consumeCaptureRecord("session-123", projectId, now)).toMatchObject({
      imageDataUrl: "data:image/jpeg;base64,abcd1234",
    });
    expect(getCaptureRecord("session-123", projectId, now)).toBeNull();
  });

  it("keeps the in-memory capture bridge bounded", () => {
    const now = Date.parse("2026-06-20T20:00:00.000Z");

    Array.from({ length: captureMaxSessions + 5 }).forEach((_, index) => {
      const sessionId = `session-${String(index).padStart(3, "0")}`;
      const projectId = `project_${String(index).padStart(3, "0")}`;

      registerCaptureSession(sessionId, { projectId }, now + index);
      saveCaptureRecord(
        sessionId,
        projectId,
        {
          imageDataUrl: "data:image/jpeg;base64,abcd1234",
          name: "room.jpg",
          type: "image/jpeg",
          size: 4,
        },
        now + index,
      );
    });

    expect(captureSessions.size).toBe(captureMaxSessions);
    expect(getCaptureRecord("session-000", "project_000", now + captureMaxSessions + 5)).toBeNull();
    expect(
      getCaptureRecord(
        `session-${String(captureMaxSessions + 4).padStart(3, "0")}`,
        `project_${String(captureMaxSessions + 4).padStart(3, "0")}`,
        now + captureMaxSessions + 5,
      ),
    ).not.toBeNull();
  });
});
