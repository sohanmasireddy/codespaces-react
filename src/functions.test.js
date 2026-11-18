import { describe, expect, it } from 'vitest';
import { onRequestGet as getConfig } from '../functions/api/config';
import { onRequestPost as postChat } from '../functions/api/chat';
import { onRequestPost as postSearch } from '../functions/api/search';

function postRequest(path, body) {
  return new Request(`https://chat.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Pages API routes', () => {
  it('returns only public provider status', async () => {
    const response = await getConfig({ env: { AI_BASE_URL: 'https://provider.test/v1', AI_MODEL: 'public-model', AI_API_KEY: 'secret' } });
    expect(await response.json()).toEqual({
      configured: true,
      model: 'public-model',
      searchAvailable: false,
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

  it('reports unavailable search without inventing results', async () => {
    const response = await postSearch({ request: postRequest('/api/search', { query: 'example' }), env: {} });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('Web search is unavailable') });
  });
});
