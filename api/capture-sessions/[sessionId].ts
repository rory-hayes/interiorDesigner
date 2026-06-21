import {
  captureMaxImageDataUrlLength,
  consumeCaptureRecord,
  isValidCaptureImageDataUrl,
  isValidCaptureSessionId,
  saveCaptureRecord,
} from "../_captureStore.js";
import { setNoStoreCacheHeaders } from "../_privacyHeaders.js";

export default function handler(request: any, response: any) {
  setNoStoreCacheHeaders(response);

  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
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

  if (request.method === "POST") {
    const body = request.body as {
      imageDataUrl?: string;
      name?: string;
      type?: string;
      size?: number;
    };

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

    saveCaptureRecord(sessionId, {
      imageDataUrl: body.imageDataUrl,
      name: body.name ?? "Phone room photo",
      type: body.type ?? "image/jpeg",
      size: body.size ?? 0,
    });

    response.status(200).json({ ok: true });
    return;
  }

  response.status(200).json({
    ok: true,
    capture: consumeCaptureRecord(sessionId),
  });
}
