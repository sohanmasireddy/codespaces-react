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
    const response = await getConfig({ env: { AI_BASE_URL: 'https://provider.test/v1', AI_MODEL: 'public-model', AI_API_KEY: 'secret' } });
    expect(await response.json()).toEqual({
      configured: true,
      model: 'public-model',
      searchAvailable: true,
    });
  });

  describe('Worker routing', () => {
    it('dispatches API requests to the existing route handlers', async () => {
      const response = await worker.fetch(
        new Request('https://chat.test/api/config'),
        { AI_BASE_URL: 'https://provider.test/v1', AI_MODEL: 'public-model', AI_API_KEY: 'secret' },
      );

      expect(await response.json()).toEqual({
        configured: true,
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
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('AI provider is not configured') });
  });

  it('rejects malformed chat input before contacting the provider', async () => {
    const response = await postChat({
      request: postRequest('/api/chat', { messages: [] }),
      env: { AI_BASE_URL: 'https://provider.test/v1', AI_MODEL: 'test', AI_API_KEY: 'dummy' },
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
      env: { AI_BASE_URL: 'https://provider.test/v1', AI_MODEL: 'test', AI_API_KEY: 'dummy' },
    });
    expect(response.status).toBe(413);
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
