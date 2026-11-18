# Carbon Chat

A React 18 + Vite chat workspace with IBM Carbon, the Vercel AI SDK, browser-local
conversation storage, and a Cloudflare Worker. The app does not return
mock responses. Until an AI provider is configured, sending is disabled and the
UI explains what is missing.

## Run locally

```sh
npm install
npm run worker:dev
```

`worker:dev` builds the Vite app and runs the Worker, API routes, and static
assets through Wrangler. For local server configuration, create an ignored
`.dev.vars` file:

```dotenv
AI_BASE_URL=https://your-openai-compatible-provider.example/v1
AI_MODEL=your-model-id
AI_API_KEY=your-provider-key
```

The chat function uses the generic AI SDK OpenAI-compatible adapter. Configure
a provider that supports the OpenAI Chat Completions-compatible API; no specific
vendor is selected. Provider credentials remain in the Worker runtime.
Do not use `VITE_` variables for secrets.

## Cloudflare Workers deployment

1. In Workers Builds, connect the repository with root directory `/`, build
   command `npm run build`, and deploy command `npx wrangler deploy`.
   `wrangler.jsonc` configures `dist/` as static assets and enables the
   `workers.dev` URL.
2. Set `AI_BASE_URL` and `AI_MODEL` as Worker environment variables. Add
   `AI_API_KEY` as a secret using `npx wrangler secret put AI_API_KEY`.
3. For a manual deployment after Wrangler authentication, run
   `npm run deploy`.

`GET /api/config` returns only whether the server is configured and the
non-secret model label. `POST /api/chat` streams AI SDK UI message chunks,
validates inputs, caps the request body at 8 MB, and returns generic provider
errors. `POST /api/search` retrieves and parses DuckDuckGo HTML results without
requiring a search API key. DuckDuckGo does not guarantee an unrestricted search
API, so availability and result format may change or be rate-limited. The
Worker serves API endpoints from `functions/api/` and static files from
`dist/`; it does not enable permissive cross-origin access.

## Implemented workspace features

- Carbon-based responsive light/dark/system UI, navigation, conversation
  search, date grouping, rename/delete, and keyboard shortcuts.
- AI SDK streaming, stop, regenerate/retry, edit-and-resend, feedback, message
  copying, local IndexedDB persistence through Dexie, and Zustand settings.
- Streamdown streaming Markdown with Shiki code highlighting, copy/download
  controls, math, Mermaid, line numbers, safe HTML handling, and safe-link
  prompts. Messages use one renderer rather than duplicating Markdown output.
- Image, PDF, and text/source attachments with size limits, image compression,
  previews, and a lightbox. Text files are included as text; images/PDFs are
  sent as model file parts. Provider support for file parts depends on the
  configured compatible model.
- Server-side DuckDuckGo web search with returned source links and no API key.
- Conversation Markdown/JSON export and JSON import.

Heavy Markdown and image-viewer code is loaded on demand. The other installed
editor, charting, terminal, diff, and workflow libraries are available for
follow-on features but are not yet wired into this app.

## Commands

- `npm start` — Vite frontend only (Worker API routes are not served here).
- `npm run worker:dev` — local Worker, API routes, and static assets.
- `npm run build` — production Vite build.
- `npm test -- --run` — run tests once.
- `npm run deploy` — build and deploy the Worker and static assets.
