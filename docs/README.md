# Binder API docs

Mintlify documentation for the Binder Public API (Phase 12).

## Files

- `docs.json` — Mintlify configuration and navigation.
- `openapi.json` — the OpenAPI 3.0 spec. **Single source of truth**, shared with
  the app: it is imported by `src/app/api/v1/openapi.json/route.ts` and served at
  `GET /api/v1/openapi.json`. Edit the spec here.
- `introduction.mdx`, `quickstart.mdx` — guide pages.

## Preview locally

```bash
# one-time
npm i -g mint

# from this directory
cd docs
mint dev
```

This serves the docs (default http://localhost:3000 — run it on a different port
than the app, e.g. `mint dev --port 3333`). The **API reference** tab is
generated from `openapi.json`.

## Not deployed yet

Hosting the docs and setting a production `servers` URL in `openapi.json` is part
of Phase 14 (Vercel deployment). Until then the spec points at
`http://localhost:3000`.
