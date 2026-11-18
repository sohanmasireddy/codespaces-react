import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { z } from 'zod';
import { searchDuckDuckGo } from '../lib/duckduckgo.js';

const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';
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

function messageText(message) {
  return message.parts
    .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text.slice(0, MAX_TEXT_CHARS))
    .join('\n');
}

function parseStreamEvent(line, writer, textId) {
  if (!line.startsWith('data:')) return false;
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return data === '[DONE]';

  const event = JSON.parse(data);
  if (typeof event.response === 'string' && event.response) {
    writer.write({ type: 'text-delta', id: textId, delta: event.response });
  }
  if (event.error) throw new Error('Workers AI returned an error.');
  return false;
}

async function pumpModelStream(stream, writer, textId, signal) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal.aborted) {
        await reader.cancel();
        return;
      }
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (parseStreamEvent(line, writer, textId)) {
          await reader.cancel();
          return;
        }
      }
      if (done) break;
    }
    if (buffer) parseStreamEvent(buffer, writer, textId);
  } finally {
    reader.releaseLock();
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) {
    return json({ error: 'Workers AI binding is missing. Add the AI binding to the deployed Worker.' }, 503);
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

  const userMessages = parsed.data.messages.filter((message) => message.role !== 'system');
  const latestUserMessage = [...userMessages].reverse().find((message) => message.role === 'user');
  const searchEnabled = parsed.data.webSearch === true;
  const textId = crypto.randomUUID();

  const stream = createUIMessageStream({
    originalMessages: parsed.data.messages,
    execute: async ({ writer }) => {
      writer.write({ type: 'start' });
      writer.write({ type: 'text-start', id: textId });

      const modelMessages = parsed.data.messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({ role: message.role, content: messageText(message) }))
        .filter((message) => message.content);
      const instructions = [
        parsed.data.systemPrompt || 'You are a helpful, accurate assistant. If you are unsure, say so.',
      ];

      if (searchEnabled && latestUserMessage) {
        const searchQuery = messageText(latestUserMessage).slice(0, 400);
        if (searchQuery.length >= 2) {
          const searchResult = await searchDuckDuckGo(searchQuery, request.signal);
          const toolCallId = crypto.randomUUID();
          writer.write({ type: 'tool-input-start', toolCallId, toolName: 'web_search' });
          writer.write({ type: 'tool-input-available', toolCallId, toolName: 'web_search', input: { query: searchQuery } });
          writer.write({ type: 'tool-output-available', toolCallId, output: searchResult });
          instructions.push(
            'Use these DuckDuckGo web search results for current information. Cite sources using the supplied result URLs; never invent citations.',
            JSON.stringify(searchResult.results),
          );
        }
      }

      modelMessages.unshift({ role: 'system', content: instructions.join('\n\n') });
      const modelStream = await env.AI.run(parsed.data.model || env.AI_MODEL || DEFAULT_MODEL, {
        messages: modelMessages,
        stream: true,
        temperature: parsed.data.temperature ?? 0.7,
        max_tokens: parsed.data.maxOutputTokens ?? 2048,
      }, { signal: request.signal });

      await pumpModelStream(modelStream, writer, textId, request.signal);
      writer.write({ type: 'text-end', id: textId });
    },
    onError: () => 'Workers AI could not complete this request.',
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { 'cache-control': 'no-cache, no-transform' },
  });
}
