import { setNoStoreCacheHeaders } from "./_privacyHeaders.js";

export default function handler(request: any, response: any) {
  setNoStoreCacheHeaders(response);

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  response.status(200).json({
    ok: true,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    mode: process.env.OPENAI_API_KEY ? "live" : "demo",
  });
}
