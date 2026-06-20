import { captureSessions } from "../../_captureStore.js";

export default function handler(request: any, response: any) {
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
  };

  if (!sessionId) {
    response.status(400).json({ error: "Missing sessionId." });
    return;
  }

  if (!body?.imageDataUrl) {
    response.status(400).json({ error: "Missing imageDataUrl." });
    return;
  }

  captureSessions.set(sessionId, {
    imageDataUrl: body.imageDataUrl,
    name: body.name ?? "Phone room photo",
    type: body.type ?? "image/jpeg",
    size: body.size ?? 0,
    uploadedAt: new Date().toISOString(),
  });

  response.status(200).json({ ok: true });
}
