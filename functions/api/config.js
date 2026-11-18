function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet({ env }) {
  return json({
    configured: Boolean(env.AI_BASE_URL && env.AI_MODEL && env.AI_API_KEY),
    model: env.AI_MODEL || null,
    searchAvailable: env.SEARCH_PROVIDER === 'tavily' && Boolean(env.SEARCH_API_KEY),
  });
}
