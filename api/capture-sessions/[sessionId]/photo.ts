import {
  captureMaxImageDataUrlLength,
  isCaptureSessionReady,
  isValidCaptureImageDataUrl,
  isValidCaptureProjectId,
  isValidCaptureSessionId,
  saveCaptureRecord,
} from "../../_captureStore.js";
import { setNoStoreCacheHeaders } from "../../_privacyHeaders.js";

export default function handler(request: any, response: any) {
  setNoStoreCacheHeaders(response);

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const sessionId = String(request.query.sessionId ?? "");
  const body = request.body as {
    imageDataUrl?: string;
    name?: string;
    type?: string;
    size?: number;
    projectId?: string;
  };

  if (!sessionId) {
    response.status(400).json({ error: "Missing sessionId." });
    return;
  }

  if (!isValidCaptureSessionId(sessionId)) {
    response.status(400).json({ error: "Invalid sessionId." });
    return;
  }

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
}
