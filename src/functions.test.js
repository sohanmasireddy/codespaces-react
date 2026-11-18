import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as getConfig } from '../functions/api/config';
import { onRequestPost as postChat } from '../functions/api/chat';
import { onRequestPost as postSearch } from '../functions/api/search';
import worker from '../worker';

function postRequest(path, body) {
  return new Request(`https://chat.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API route handlers', () => {
  it('returns only public provider status', async () => {
    const response = await getConfig({ env: { AI: {}, AI_MODEL: 'public-model' } });
    expect(await response.json()).toEqual({
      configured: true,
      missing: [],
      model: 'public-model',
      searchAvailable: true,
    });
  });

  describe('Worker routing', () => {
    it('dispatches API requests to the existing route handlers', async () => {
      const response = await worker.fetch(
        new Request('https://chat.test/api/config'),
        { AI: {}, AI_MODEL: 'public-model' },
      );

      expect(await response.json()).toEqual({
        configured: true,
        missing: [],
        model: 'public-model',
        searchAvailable: true,
      });
    });

    it('returns 405 for unsupported API methods', async () => {
      const response = await worker.fetch(
        new Request('https://chat.test/api/chat', { method: 'GET' }),
        { ASSETS: { fetch: () => { throw new Error('Static assets should not handle API requests'); } } },
      );

      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
    });

    it('forwards non-API requests to static assets', async () => {
      const assetResponse = new Response('app shell');
      const response = await worker.fetch(
        new Request('https://chat.test/'),
        { ASSETS: { fetch: () => assetResponse } },
      );

      expect(response).toBe(assetResponse);
    });
  });

  it('reports missing provider configuration without attempting a model call', async () => {
    const response = await postChat({ request: postRequest('/api/chat', { messages: [] }), env: {} });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'Workers AI binding is missing. Add the AI binding to the deployed Worker.' });
  });

  it('reports the missing AI binding without exposing secret values', async () => {
    const response = await getConfig({ env: { AI_MODEL: 'public-model', AI_API_KEY: 'must-not-be-returned' } });
    expect(await response.json()).toEqual({
      configured: false,
      missing: ['Workers AI binding (AI)'],
      model: 'public-model',
      searchAvailable: true,
    });
  });

  it('rejects malformed chat input before contacting the provider', async () => {
    const response = await postChat({
      request: postRequest('/api/chat', { messages: [] }),
      env: { AI: { run: vi.fn() }, AI_MODEL: 'test' },
    });
    expect(response.status).toBe(400);
  });

  it('rejects oversized chat requests before parsing the body', async () => {
    const request = new Request('https://chat.test/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(8 * 1024 * 1024 + 1) },
      body: '{}',
    });
    const response = await postChat({
      request,
      env: { AI: { run: vi.fn() }, AI_MODEL: 'test' },
    });
    expect(response.status).toBe(413);
  });

  it('streams Workers AI output in the AI SDK UI message protocol', async () => {
    const aiStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"response":"Hello from "}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"response":"Workers AI"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    const run = vi.fn(async () => aiStream);
    const response = await postChat({
      request: postRequest('/api/chat', {
        messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Say hello' }] }],
      }),
      env: { AI: { run }, AI_MODEL: '@cf/google/gemma-4-26b-a4b-it' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
    const streamText = await response.text();
    expect(streamText).toContain('"delta":"Hello from "');
    expect(streamText).toContain('"delta":"Workers AI"');
    expect(run).toHaveBeenCalledWith(
      '@cf/google/gemma-4-26b-a4b-it',
      expect.objectContaining({ stream: true, messages: expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'Say hello' })]) }),
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('returns parsed DuckDuckGo results without requiring credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`
      <a class="result__a" href="https://example.com/article">A &amp; B</a>
      <a class="result__snippet">Useful &lt;summary&gt; text</a>
      <a class="result__a" href="javascript:alert(1)">Unsafe result</a>
    `)));
    const response = await postSearch({ request: postRequest('/api/search', { query: 'example query' }), env: {} });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      results: [{ title: 'A & B', url: 'https://example.com/article', content: 'Useful <summary> text' }],
      images: [],
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining('q=example+query') }),
      expect.objectContaining({ signal: expect.anything() }),
    );
  });
});
