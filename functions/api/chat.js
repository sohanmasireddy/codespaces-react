import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { z } from 'zod';

const requestSchema = z.object({
  messages: z.array(z.object({
    id: z.string().max(200).optional(),
    role: z.enum(['system', 'user', 'assistant']),
    parts: z.array(z.unknown()).max(100),
  }).passthrough()).min(1).max(80),
  model: z.string().trim().min(1).max(160).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(64).max(8192).optional(),
  systemPrompt: z.string().max(8000).optional(),
  webSearch: z.boolean().optional(),
});
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 100_000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function readBoundedJson(request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new RangeError('Request is too large.');
  if (!request.body) throw new SyntaxError('Request body is missing.');

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError('Request is too large.');
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

async function runSearch(query, env, signal) {
  if (env.SEARCH_PROVIDER !== 'tavily' || !env.SEARCH_API_KEY) {
    return { available: false, message: 'Web search is unavailable because no supported search provider is configured.' };
  }
  const response = await fetch(env.SEARCH_API_URL || 'https://api.tavily.com/search', {
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

export async function onRequestPost({ request, env }) {
  if (!env.AI_BASE_URL || !env.AI_MODEL || !env.AI_API_KEY) {
    return json({ error: 'AI provider is not configured. Set AI_BASE_URL, AI_MODEL, and AI_API_KEY in Cloudflare.' }, 503);
  }

  let payload;
  try {
    payload = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof RangeError) return json({ error: error.message }, 413);
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return json({ error: 'Invalid chat request. Check the message format and generation settings.' }, 400);

  const normalizedMessages = parsed.data.messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string') {
        return { ...part, text: part.text.slice(0, MAX_TEXT_CHARS) };
      }
      return part;
    }),
  }));
  const provider = createOpenAICompatible({
    name: 'configured',
    baseURL: env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
    supportsStructuredOutputs: true,
  });
  const webSearchAvailable = parsed.data.webSearch && env.SEARCH_PROVIDER === 'tavily' && Boolean(env.SEARCH_API_KEY);
  const tools = webSearchAvailable
    ? {
        web_search: tool({
          description: 'Search the web for current information. Use this for recent facts or when the user explicitly asks for web research. Return source URLs with the findings.',
          inputSchema: z.object({ query: z.string().min(2).max(400) }),
          execute: async ({ query }, { abortSignal }) => runSearch(query, env, abortSignal),
        }),
      }
    : undefined;

  try {
    const result = streamText({
      model: provider(parsed.data.model || env.AI_MODEL),
      messages: await convertToModelMessages(normalizedMessages),
      instructions: [
        parsed.data.systemPrompt || 'You are a helpful, accurate assistant. If you are unsure, say so.',
        parsed.data.webSearch && !webSearchAvailable
          ? 'Web search was requested but is unavailable. Be transparent and do not invent current information or citations.'
          : '',
        webSearchAvailable
          ? 'When web_search is used, cite sources with Markdown links using the URLs returned by the tool. Never invent citations.'
          : '',
      ].filter(Boolean).join('\n\n'),
      temperature: parsed.data.temperature ?? 0.7,
      maxOutputTokens: parsed.data.maxOutputTokens ?? 2048,
      tools,
      stopWhen: tools ? stepCountIs(4) : undefined,
      abortSignal: request.signal,
    });
    return result.toUIMessageStreamResponse({
      headers: { 'cache-control': 'no-cache, no-transform' },
      onError: () => 'The configured AI provider could not complete this request.',
    });
  } catch {
    return json({ error: 'The configured AI provider could not start this request.' }, 502);
  }
}
