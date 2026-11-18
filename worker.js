import { onRequestPost as handleChat } from './functions/api/chat.js';
import { onRequestGet as handleConfig } from './functions/api/config.js';
import { onRequestPost as handleSearch } from './functions/api/search.js';

const routes = {
  '/api/chat': { POST: handleChat },
  '/api/config': { GET: handleConfig },
  '/api/search': { POST: handleSearch },
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = routes[url.pathname];

    if (url.pathname.startsWith('/api/')) {
      if (!route) return json({ error: 'API route not found.' }, 404);
      const handler = route[request.method];
      if (!handler) {
        return new Response(null, {
          status: 405,
          headers: { allow: Object.keys(route).join(', ') },
        });
      }
      return handler({ request, env });
    }

    return env.ASSETS.fetch(request);
  },
};
