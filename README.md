# AI Chatbot

<<<<<<< HEAD
A modern, full-featured AI chatbot built with React, Vite, IBM Carbon, and the Vercel AI SDK. Designed for fast streaming responses, rich Markdown rendering, interactive code blocks, file attachments, and deployment on Cloudflare Pages.
=======
A React 18 + Vite chat workspace with IBM Carbon, the Vercel AI SDK, browser-local
conversation storage, and a Cloudflare Worker. It uses a native Workers AI
binding, so it does not need a provider API token. The app does not return
mock responses. Sending is disabled until the Worker is deployed with its
Workers AI binding.
>>>>>>> 3163039 (s)

## Features

### AI Chat
- Real-time token streaming
- Multi-turn conversations
- Conversation history
- Stop and regenerate responses
- Edit and resend messages
- Copy messages and code blocks
- Conversation search
- Persistent local storage

### Rich Message Rendering
- Streaming Markdown
- Syntax-highlighted code blocks
- Tables and lists
- Mathematical equations and LaTeX
- Mermaid diagrams
- Rich text formatting
- Interactive charts and visualizations

### Developer Tools
- Monaco code editor
- Syntax highlighting with Shiki
- Code comparison and diffs
- Terminal interface with Xterm.js
- Code copying and downloading

### File Support
- Drag-and-drop uploads
- Multiple file attachments
- Image previews
- Document attachments
- File validation
- Upload progress
- Image viewing and zooming

### User Interface
- IBM Carbon component system
- Responsive layout
- Light and dark themes
- Animated transitions
- Resizable panels
- Conversation sidebar
- Keyboard shortcuts
- Toast notifications

### Additional Capabilities
- Web search integration
- Interactive charts
- Mermaid flowcharts
- React Flow diagrams
- Conversation export and import
- Configurable AI settings

## Technology Stack

| Technology | Purpose |
|---|---|
| React | Frontend framework |
| Vite | Development and build tooling |
| IBM Carbon | Primary UI system |
| Vercel AI SDK | AI integration and streaming |
| Cloudflare Pages | Hosting and deployment |
| Cloudflare Pages Functions | Server-side API |
| Shiki | Code syntax highlighting |
| Streamdown | Streaming Markdown |
| Monaco Editor | Code editing |
| Motion | Animations |
| Zustand | State management |
| Dexie | IndexedDB persistence |
| Recharts | Data visualization |
| Mermaid | Diagrams |
| Tiptap | Rich text editing |
| React Virtuoso | Virtualized conversations |
| Sonner | Notifications |

## Requirements

- Node.js
- npm
- Cloudflare account
- GitHub account (for Git-based deployment)
- An API key for your chosen AI provider

Additional API credentials may be required for web search and other integrations.

## Installation

Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
cd YOUR_PROJECT_DIRECTORY
```

Install dependencies:

```bash
npm install
```

Start the development server:

<<<<<<< HEAD
```bash
npm run dev
```

Open the local URL provided by Vite.
=======
```dotenv
AI_MODEL=@cf/google/gemma-4-26b-a4b-it
```

The Workers AI `AI` binding is configured in `wrangler.jsonc`; it requires no
API key or account ID. `AI_MODEL` is an optional Worker variable and defaults
to `@cf/google/gemma-4-26b-a4b-it`. Do not put AI credentials in frontend
variables.
>>>>>>> 3163039 (s)

## Environment Variables

<<<<<<< HEAD
Configure sensitive credentials through Cloudflare Pages environment variables and secrets.
=======
1. In Workers Builds, connect the repository with root directory `/`, build
   command `npm run build`, and deploy command `npx wrangler deploy`.
   `wrangler.jsonc` configures `dist/` as static assets and enables the
   `workers.dev` URL.
2. The `AI` binding is configured in `wrangler.jsonc`; no Workers AI API token
   or account ID is needed. Optionally set `AI_MODEL` as a Worker variable.
3. For a manual deployment after Wrangler authentication, run
   `npm run deploy`.
>>>>>>> 3163039 (s)

Examples of configuration names:

```env
AI_API_KEY=
AI_MODEL=
AI_BASE_URL=
SEARCH_API_KEY=
```

These are example names. The actual variables must match the application's backend implementation.

**Never expose API keys through frontend variables prefixed with `VITE_`.**

## Build

Create a production build:

```bash
npm run build
```

The production output is generated in:

```text
dist/
```

Preview the production build locally:

```bash
npm run preview
```

## Cloudflare Pages Deployment

This project is designed for Cloudflare Pages.

Recommended build settings:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

Deploy using GitHub integration or Wrangler:

```bash
npx wrangler pages deploy dist
```

For local Cloudflare Pages testing:

```bash
npx wrangler pages dev dist
```

Configure your Cloudflare environment variables and secrets before deploying API-dependent features.

## Project Structure

```text
project/
├── functions/
│   └── api/
│       ├── chat.js
│       └── search.js
├── public/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   ├── composer/
│   │   ├── messages/
│   │   ├── markdown/
│   │   ├── code/
│   │   ├── attachments/
│   │   ├── sidebar/
│   │   ├── settings/
│   │   ├── charts/
│   │   └── diagrams/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── stores/
│   ├── styles/
│   └── utils/
├── index.html
├── package.json
├── vite.config.js
└── wrangler.toml
```

The structure is illustrative and should reflect the actual project files.

## Development

Contributions and improvements are welcome.

When developing new features:

1. Prefer existing libraries over custom implementations.
2. Follow the existing IBM Carbon design system.
3. Keep API credentials server-side.
4. Maintain compatibility with Cloudflare Pages.
5. Test production builds before deployment.
6. Keep components reusable and modular.

## License

Specify your preferred project license here.

---

Built with React, IBM Carbon, Vercel AI SDK, and Cloudflare.
