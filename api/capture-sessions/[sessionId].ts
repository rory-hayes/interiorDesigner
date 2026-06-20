import { consumeCaptureRecord, isValidCaptureSessionId } from "../_captureStore.js";

export default function handler(request: any, response: any) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
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

  response.status(200).json({
    ok: true,
    capture: consumeCaptureRecord(sessionId),
  });
}
