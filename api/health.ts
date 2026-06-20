export default function handler(_request: any, response: any) {
  response.status(200).json({
    ok: true,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    mode: process.env.OPENAI_API_KEY ? "live" : "demo",
  });
}
