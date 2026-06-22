import { isSupportedRoomImageDataUrl, roomImageDataUrlMaxLength } from "./_imageDataUrl.js";

interface CaptureRecord {
  imageDataUrl: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

interface CaptureSession {
  projectId: string;
  ownerId?: string;
  registeredAt: string;
  expiresAt: string;
  capture?: CaptureRecord;
}

const captureMaxAgeMs = 30 * 60 * 1000;
const captureTokenMaxAgeMs = 12 * 60 * 1000;
const captureMaxSessions = 100;
const captureMaxImageDataUrlLength = roomImageDataUrlMaxLength;
const captureSessionIdPattern = /^[a-zA-Z0-9-]{6,80}$/;
const captureProjectIdPattern = /^[a-zA-Z0-9_.-]{6,180}$/;

declare global {
  var __roomwiseCaptureSessions: Map<string, CaptureSession> | undefined;
}

export const captureSessions = globalThis.__roomwiseCaptureSessions ?? new Map<string, CaptureSession>();

globalThis.__roomwiseCaptureSessions = captureSessions;

export function isValidCaptureSessionId(sessionId: string) {
  return captureSessionIdPattern.test(sessionId);
}

export function isValidCaptureProjectId(projectId: string) {
  return captureProjectIdPattern.test(projectId);
}

export function isValidCaptureImageDataUrl(imageDataUrl: string) {
  return isSupportedRoomImageDataUrl(imageDataUrl);
}

export function cleanupExpiredCaptureSessions(now = Date.now()) {
  for (const [sessionId, session] of captureSessions.entries()) {
    const expiresAt = Date.parse(session.expiresAt);
    const uploadedAt = session.capture ? Date.parse(session.capture.uploadedAt) : Number.NaN;

    if (!Number.isFinite(expiresAt) || now > expiresAt) {
      captureSessions.delete(sessionId);
      continue;
    }

    if (session.capture && (!Number.isFinite(uploadedAt) || now - uploadedAt > captureMaxAgeMs)) {
      captureSessions.delete(sessionId);
    }
  }
}

function trimCaptureSessions() {
  while (captureSessions.size > captureMaxSessions) {
    const oldestSessionId = captureSessions.keys().next().value as string | undefined;

    if (!oldestSessionId) {
      return;
    }

    captureSessions.delete(oldestSessionId);
  }
}

export function registerCaptureSession(
  sessionId: string,
  input: {
    projectId: string;
    ownerId?: string;
  },
  now = Date.now(),
) {
  cleanupExpiredCaptureSessions(now);

  const registeredAt = new Date(now).toISOString();
  const expiresAt = new Date(now + captureTokenMaxAgeMs).toISOString();

  captureSessions.set(sessionId, {
    projectId: input.projectId,
    ownerId: input.ownerId,
    registeredAt,
    expiresAt,
  });
  trimCaptureSessions();
}

export function getCaptureSession(sessionId: string, now = Date.now()) {
  cleanupExpiredCaptureSessions(now);

  return captureSessions.get(sessionId) ?? null;
}

export function isCaptureSessionReady(sessionId: string, projectId: string, now = Date.now()) {
  const session = getCaptureSession(sessionId, now);

  return Boolean(session && session.projectId === projectId);
}

export function getCaptureRecord(sessionId: string, projectId: string, now = Date.now()) {
  const session = getCaptureSession(sessionId, now);

  if (!session || session.projectId !== projectId) {
    return null;
  }

  return session.capture ?? null;
}

export function consumeCaptureRecord(sessionId: string, projectId: string, now = Date.now()) {
  const capture = getCaptureRecord(sessionId, projectId, now);

  if (capture) {
    captureSessions.delete(sessionId);
  }

  return capture;
}

export function saveCaptureRecord(
  sessionId: string,
  projectId: string,
  capture: Omit<CaptureRecord, "uploadedAt">,
  now = Date.now(),
) {
  cleanupExpiredCaptureSessions(now);

  const session = captureSessions.get(sessionId);

  if (!session || session.projectId !== projectId) {
    return false;
  }

  captureSessions.set(sessionId, {
    ...session,
    expiresAt: new Date(now + captureMaxAgeMs).toISOString(),
    capture: {
      ...capture,
      uploadedAt: new Date(now).toISOString(),
    },
  });
  trimCaptureSessions();

  return true;
}

export { captureMaxAgeMs, captureMaxImageDataUrlLength, captureMaxSessions, captureTokenMaxAgeMs };
export type { CaptureRecord, CaptureSession };
