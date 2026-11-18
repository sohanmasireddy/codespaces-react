# Carbon Chat

A React 18 + Vite chat workspace with IBM Carbon, the Vercel AI SDK, browser-local
conversation storage, and Cloudflare Pages Functions. The app does not return
mock responses. Until an AI provider is configured, sending is disabled and the
UI explains what is missing.

## Run locally

```sh
npm install
npm run pages:dev
```

`pages:dev` builds the Vite app and runs its `dist/` output together with the
Pages Functions through Wrangler. For local server configuration, create an
ignored `.dev.vars` file:

```dotenv
AI_BASE_URL=https://your-openai-compatible-provider.example/v1
AI_MODEL=your-model-id
AI_API_KEY=your-provider-key

# Optional web search (Tavily-compatible API)
SEARCH_PROVIDER=tavily
SEARCH_API_KEY=your-search-key
# Optional override for a compatible search endpoint:
# SEARCH_API_URL=https://your-search-provider.example/search
```

The chat function uses the generic AI SDK OpenAI-compatible adapter. Configure
a provider that supports the OpenAI Chat Completions-compatible API; no specific
vendor is selected. Provider credentials remain in the Pages Function runtime.
Do not use `VITE_` variables for secrets.

## Cloudflare Pages deployment

1. Create a Pages project named `codespaces-react` and connect the repository.
   Set the build command to `npm run build` and output directory to `dist`.
2. Set `AI_BASE_URL` and `AI_MODEL` as Pages environment variables. Set
   `AI_API_KEY` with `npx wrangler pages secret put AI_API_KEY`.
3. Optionally set `SEARCH_PROVIDER=tavily` and add the `SEARCH_API_KEY` secret.
   `SEARCH_API_URL` may point at a compatible search endpoint.
4. Deploy with `npm run pages:deploy` after Wrangler is authenticated. The
   function routes under `functions/api/` are deployed with Pages.

`GET /api/config` returns only whether the server is configured and the
non-secret model label. `POST /api/chat` streams AI SDK UI message chunks,
validates inputs, caps the request body at 8 MB, and returns generic provider
errors. `POST /api/search` returns a clear unavailable response until the
supported search provider is configured. Same-origin Pages routes are used;
the functions do not enable permissive cross-origin access.

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
- Server-side Tavily web search tool when configured, with returned source
  links; no fabricated search results when search is unavailable.
- Conversation Markdown/JSON export and JSON import.

Heavy Markdown and image-viewer code is loaded on demand. The other installed
editor, charting, terminal, diff, and workflow libraries are available for
follow-on features but are not yet wired into this app.

## Commands

- `npm start` — Vite frontend only (Pages API functions are not served here).
- `npm run pages:dev` — local Pages app and functions.
- `npm run build` — production Vite build.
- `npm test -- --run` — run tests once.
- `npm run pages:deploy` — build and deploy Pages output.
