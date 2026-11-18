import { z } from 'zod';

const requestSchema = z.object({
  query: z.string().trim().min(2).max(400),
});
const MAX_BODY_BYTES = 4096;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function searchTavily(query, env, signal) {
  const endpoint = env.SEARCH_API_URL || 'https://api.tavily.com/search';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      api_key: env.SEARCH_API_KEY,
      query,
      max_results: 5,
      include_images: true,
      include_answer: false,
    }),
    signal,
  });
  if (!response.ok) throw new Error('Search provider request failed');
  const payload = await response.json();
  return {
    results: (payload.results || []).slice(0, 5).map((item) => ({
      title: String(item.title || '').slice(0, 300),
      url: String(item.url || ''),
      content: String(item.content || '').slice(0, 1200),
    })),
    images: (payload.images || []).slice(0, 4).map((item) =>
      typeof item === 'string' ? { url: item } : { url: String(item.url || ''), description: String(item.description || '').slice(0, 200) },
    ),
  };
}

async function readBoundedJson(request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new RangeError();
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function onRequestPost({ request, env }) {
  if (!env.SEARCH_API_KEY || env.SEARCH_PROVIDER !== 'tavily') {
    return json({ error: 'Web search is unavailable. Configure SEARCH_PROVIDER=tavily and SEARCH_API_KEY.' }, 503);
  }
  let payload;
  try {
    payload = await readBoundedJson(request);
  } catch {
    return json({ error: 'Invalid or oversized search request.' }, 400);
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return json({ error: 'Enter a search query between 2 and 400 characters.' }, 400);

  try {
    const result = await searchTavily(parsed.data.query, env, request.signal);
    return json(result);
  } catch {
    return json({ error: 'The configured search provider could not complete the request.' }, 502);
  }
}
