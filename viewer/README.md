# Minni Viewer

Web interface for Minni, served by Bun on port 8593.

## Stack

- React 19
- TanStack Router
- TanStack Store
- Tailwind CSS v4
- Vite 7

## Features

### Canvas

Real-time markdown display for LLM-to-human communication.

- SSE connection for live updates
- Page history with navigation
- Copy as Markdown, Plain Text, or HTML
- Delete individual pages

### API Endpoints

| Endpoint                 | Method | Description                             |
| ------------------------ | ------ | --------------------------------------- |
| `/api/canvas/stream`     | GET    | SSE stream for real-time updates        |
| `/api/canvas/push`       | POST   | Add markdown page `{ content: string }` |
| `/api/canvas/pages`      | GET    | Get all pages                           |
| `/api/canvas/delete/:id` | DELETE | Delete specific page                    |
| `/api/canvas/clear`      | POST   | Delete all pages                        |
| `/api/runtime`           | GET    | Bun version and feature flags           |
| `/api/stats`             | GET    | Database counts                         |
| `/api/projects`          | GET    | List projects                           |
| `/api/memories`          | GET    | List memories (optional `?project=id`)  |
| `/api/tasks`             | GET    | List tasks (optional `?project=id`)     |

## Development

```bash
# Install dependencies
bun install

# Dev server with hot reload
bun run dev

# Build for production
bun run build
```

The production build goes to `dist/` and is served by the Bun server in `server.ts`.

## Architecture

```
viewer/
├── server.ts           # Bun HTTP server (runs in OpenCode process)
├── src/
│   ├── main.tsx        # TanStack Router setup
│   ├── stores/
│   │   └── canvas.ts   # TanStack Store for canvas state + SSE
│   └── components/
│       └── canvas/
│           ├── Canvas.tsx
│           └── CopyButtons.tsx
└── dist/               # Production build (served by server.ts)
```

## Notes

- The server runs in the same Bun process as the Minni plugin
- SSE heartbeat every 30s to keep connections alive
- Canvas pages are stored in memory (not database), max 20 pages
- Markdown rendering uses `Bun.markdown` (requires Bun 1.3.8+) with `marked` fallback
