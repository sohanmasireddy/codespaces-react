import { z } from 'zod';
import { searchDuckDuckGo } from '../lib/duckduckgo.js';

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

export async function onRequestPost({ request }) {
  let payload;
  try {
    payload = await readBoundedJson(request);
  } catch {
    return json({ error: 'Invalid or oversized search request.' }, 400);
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return json({ error: 'Enter a search query between 2 and 400 characters.' }, 400);

  try {
    const result = await searchDuckDuckGo(parsed.data.query, request.signal);
    return json(result);
  } catch {
    return json({ error: 'DuckDuckGo could not complete the search request.' }, 502);
  }
}
