import {
  captureMaxImageDataUrlLength,
  consumeCaptureRecord,
  isCaptureSessionReady,
  isValidCaptureImageDataUrl,
  isValidCaptureProjectId,
  isValidCaptureSessionId,
  registerCaptureSession,
  saveCaptureRecord,
} from "../_captureStore.js";
import { setNoStoreCacheHeaders } from "../_privacyHeaders.js";

export default function handler(request: any, response: any) {
  setNoStoreCacheHeaders(response);

  if (request.method !== "GET" && request.method !== "POST" && request.method !== "PUT") {
    response.setHeader("Allow", "GET, POST, PUT");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const sessionId = String(request.query.sessionId ?? "");

  if (!sessionId) {
    response.status(400).json({ error: "Missing sessionId." });
    return;
  }

  if (!isValidCaptureSessionId(sessionId)) {
    response.status(400).json({ error: "Invalid sessionId." });
    return;
  }

  if (request.method === "PUT") {
    const body = request.body as {
      projectId?: string;
      ownerId?: string;
    };
    const projectId = String(body?.projectId ?? "");
    const ownerId = typeof body?.ownerId === "string" ? body.ownerId : undefined;

    if (!projectId) {
      response.status(400).json({ error: "Missing projectId." });
      return;
    }

    if (!isValidCaptureProjectId(projectId)) {
      response.status(400).json({ error: "Invalid projectId." });
      return;
    }

    registerCaptureSession(sessionId, { projectId, ownerId });
    response.status(200).json({ ok: true });
    return;
  }

  if (request.method === "POST") {
    const body = request.body as {
      imageDataUrl?: string;
      name?: string;
      type?: string;
      size?: number;
      projectId?: string;
    };
    const projectId = String(body?.projectId ?? "");

    if (!projectId) {
      response.status(400).json({ error: "Missing projectId." });
      return;
    }

    if (!isValidCaptureProjectId(projectId)) {
      response.status(400).json({ error: "Invalid projectId." });
      return;
    }

    if (!isCaptureSessionReady(sessionId, projectId)) {
      response.status(403).json({ error: "Capture link expired. Scan the QR code again." });
      return;
    }

    if (!body?.imageDataUrl) {
      response.status(400).json({ error: "Missing imageDataUrl." });
      return;
    }

    if (body.imageDataUrl.length > captureMaxImageDataUrlLength) {
      response.status(413).json({ error: "Room photo is too large. Please upload a smaller JPG, PNG, or WebP image." });
      return;
    }

    if (!isValidCaptureImageDataUrl(body.imageDataUrl)) {
      response.status(400).json({ error: "Invalid imageDataUrl. Please upload a JPG, PNG, or WebP image." });
      return;
    }

    const saved = saveCaptureRecord(sessionId, projectId, {
      imageDataUrl: body.imageDataUrl,
      name: body.name ?? "Phone room photo",
      type: body.type ?? "image/jpeg",
      size: body.size ?? 0,
    });

    if (!saved) {
      response.status(403).json({ error: "Capture link expired. Scan the QR code again." });
      return;
    }

    response.status(200).json({ ok: true });
    return;
  }

  const projectId = String(request.query.projectId ?? "");

  if (!projectId) {
    response.status(400).json({ error: "Missing projectId." });
    return;
  }

  if (!isValidCaptureProjectId(projectId)) {
    response.status(400).json({ error: "Invalid projectId." });
    return;
  }

  if (!isCaptureSessionReady(sessionId, projectId)) {
    response.status(404).json({ ok: false, capture: null, error: "Capture link expired." });
    return;
  }

  response.status(200).json({
    ok: true,
    capture: consumeCaptureRecord(sessionId, projectId),
  });
}
