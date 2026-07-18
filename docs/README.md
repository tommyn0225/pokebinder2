# Binder API docs

Mintlify documentation for the Binder Public API.

## Files

- `docs.json` — Mintlify configuration and navigation.
- `openapi.json` — the OpenAPI 3.0 spec. **Single source of truth**, shared with
  the app: it is imported by `src/app/api/v1/openapi.json/route.ts` and served at
  `GET /api/v1/openapi.json`. Edit the spec here, then run `npx tsc --noEmit` and
  `npm test` from the repo root.
- `introduction.mdx`, `quickstart.mdx` — landing and tutorial.
- `guides/` — task-based how-to pages.
- `concepts/` — explanations (catalog, prices).
- `reference/` — conventions and changelog.

The **API reference** tab is generated from `openapi.json` — those endpoint pages
are not hand-authored.

## Preview locally

```bash
# one-time
npm i -g mint

# from this directory, on a port other than the app's 3000
cd docs
mint dev --port 3333
```

The `mint` CLI requires an LTS Node (it refuses Node 25+). If the machine only
has Node 25, validate instead with `python3 -m json.tool openapi.json`,
`npx tsc --noEmit`, and `npm test`, and verify rendering on the deployed site.

## Not deployed yet

Hosting the docs and setting a production `servers` URL in `openapi.json` is part
of the later Vercel deployment phase. Until then the spec points at
`http://localhost:3000`.
