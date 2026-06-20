import { isSupportedRoomImageDataUrl, roomImageDataUrlMaxLength } from "./_imageDataUrl.js";

interface CaptureRecord {
  imageDataUrl: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

const captureMaxAgeMs = 30 * 60 * 1000;
const captureMaxImageDataUrlLength = roomImageDataUrlMaxLength;
const captureSessionIdPattern = /^[a-zA-Z0-9-]{6,80}$/;

declare global {
  var __roomwiseCaptureSessions: Map<string, CaptureRecord> | undefined;
}

export const captureSessions = globalThis.__roomwiseCaptureSessions ?? new Map<string, CaptureRecord>();

globalThis.__roomwiseCaptureSessions = captureSessions;

export function isValidCaptureSessionId(sessionId: string) {
  return captureSessionIdPattern.test(sessionId);
}

export function isValidCaptureImageDataUrl(imageDataUrl: string) {
  return isSupportedRoomImageDataUrl(imageDataUrl);
}

export function cleanupExpiredCaptureSessions(now = Date.now()) {
  for (const [sessionId, capture] of captureSessions.entries()) {
    const uploadedAt = Date.parse(capture.uploadedAt);

    if (!Number.isFinite(uploadedAt) || now - uploadedAt > captureMaxAgeMs) {
      captureSessions.delete(sessionId);
    }
  }
}

export function getCaptureRecord(sessionId: string, now = Date.now()) {
  cleanupExpiredCaptureSessions(now);

  return captureSessions.get(sessionId) ?? null;
}

export function saveCaptureRecord(
  sessionId: string,
  capture: Omit<CaptureRecord, "uploadedAt">,
  now = Date.now(),
) {
  cleanupExpiredCaptureSessions(now);
  captureSessions.set(sessionId, {
    ...capture,
    uploadedAt: new Date(now).toISOString(),
  });
}

export { captureMaxAgeMs, captureMaxImageDataUrlLength };
export type { CaptureRecord };
