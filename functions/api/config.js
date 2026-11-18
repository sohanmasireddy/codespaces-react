function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';

export async function onRequestGet({ env }) {
  return json({
    configured: Boolean(env.AI),
    missing: env.AI ? [] : ['Workers AI binding (AI)'],
    model: env.AI_MODEL || DEFAULT_MODEL,
    searchAvailable: true,
  });
}
