import { captureSessions } from "../_captureStore";

export default function handler(request: any, response: any) {
  const sessionId = String(request.query.sessionId ?? "");

  if (!sessionId) {
    response.status(400).json({ error: "Missing sessionId." });
    return;
  }

  response.status(200).json({
    ok: true,
    capture: captureSessions.get(sessionId) ?? null,
  });
}
