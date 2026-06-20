import { getCaptureRecord, isValidCaptureSessionId } from "../_captureStore.js";

export default function handler(request: any, response: any) {
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
    capture: getCaptureRecord(sessionId),
  });
}
