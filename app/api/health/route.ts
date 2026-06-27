function getRuntimeValue(key: string) {
  return process.env[key];
}

export async function GET() {
  const openaiConfigured = Boolean(getRuntimeValue("OPENAI_API_KEY"));

  return Response.json(
    {
      ok: true,
      mode: openaiConfigured ? "live" : "demo",
      openaiConfigured,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
