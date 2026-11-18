function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet({ env }) {
  const missing = [
    !env.AI_BASE_URL && 'AI_BASE_URL',
    !env.AI_MODEL && 'AI_MODEL',
    !env.AI_API_KEY && 'AI_API_KEY',
  ].filter(Boolean);

  return json({
    configured: missing.length === 0,
    missing,
    model: env.AI_MODEL || null,
    searchAvailable: true,
  });
}
