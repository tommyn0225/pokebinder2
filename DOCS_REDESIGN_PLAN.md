# Docs Redesign Plan — "Great Mintlify Documentation, 2026"

A self-contained execution plan for rebuilding the Binder API docs (`docs/`).
The executor is expected to follow this plan without access to the conversation
that produced it. Everything needed is in this file, the repo, and the sources
listed at the bottom.

**Status: pre-approved.** Do not re-litigate the plan or ask for a go-ahead on
each page. Ask the user only when you must *deviate* from this plan or when a
fact cannot be verified from the repo.

---

## 1. Context you must know before touching anything

- **The product**: Binder, a free multi-TCG collection tracker (MTG / Pokémon /
  One Piece). It exposes a small, read-only, no-auth public API ("v1") that
  serves Binder's own value-added layer — public binders, trade lists, a
  normalized card catalog, and price history built from Binder's own daily
  snapshots. Full project context: `CLAUDE.md` at the repo root. Read it first.
- **The docs**: a Mintlify site living in `docs/`. Config is `docs/docs.json`
  (note: *inside* `docs/`, not repo root — the Mintlify project's content
  directory is set to `docs`). Deployed at
  `https://binder-23234d81.mintlify.site/` from `origin/main` on push.
- **Single source of truth**: `docs/openapi.json` is imported at build time by
  `src/app/api/v1/openapi.json/route.ts` and served live at
  `/api/v1/openapi.json`. It must always remain valid JSON at that exact path,
  and `npx tsc --noEmit` must pass after edits.
- **Ground truth for API behavior** (document only what these implement —
  never invent):
  - Routes: `src/app/api/v1/**/route.ts`, `src/app/api/demo/cards/route.ts`
  - Shared serialization/envelope/ETag: `src/lib/publicApi.ts`
  - Rate limiting: `src/proxy.ts` (60 GET req/min/IP on `/api/v1`, fails open)
  - Demo cap: 3 pulls/IP/day on `/api/demo/cards` (server-side counter;
    migration `supabase/migrations/20240112000000_demo_rate_count.sql` — may
    not be applied yet, in which case the cap fails open. Document the cap as
    designed either way.)
- **Existing docs pages**: `introduction.mdx`, `quickstart.mdx` only. Both get
  rewritten/replaced under this plan. The API reference tab is auto-generated
  from `openapi.json` — those endpoint pages are not hand-authored.
- **Tooling constraint**: the `mint` CLI refuses Node 25+, and this machine has
  Node 25 only. You cannot run `mint dev` / `mint broken-links` locally unless
  an LTS Node is available (check first: `mint --version`). Validate JSON with
  `python3 -m json.tool`, typecheck with `npx tsc --noEmit`, run `npm test`,
  and verify rendering on the deployed site after the user pushes.

## 2. Hard constraints (violating any of these is a failed execution)

1. **Never commit or push.** Tell the user exactly what to commit when done.
   No commit message or content may mention AI tooling of any kind.
2. **Attribution is a license condition, not polish.** Scryfall (MTG),
   PokéWallet (Pokémon), and OPTCG API (One Piece) must stay credited in the
   introduction and the OpenAPI `info.description`, and the docs must keep
   stating that every API response carries an `attribution` field.
3. **Trade lists are ALWAYS public** (there is no toggle — an earlier design
   had one; it was removed). Never write "make the trade list public" or
   "toggled to public". Binders, by contrast, DO have a public/private toggle.
4. **Cost basis is private.** `acquired_price_usd` / gain-loss data never
   appears in the public API and must not appear in these docs.
5. **Do not invent endpoints, parameters, fields, or behaviors.** Every claim
   must be traceable to the route code or `src/lib/publicApi.ts`. When the spec
   and code disagree, the code wins — fix the spec.
6. **No production base URL exists yet** (deployment is a later phase). The
   only server is `http://localhost:3000`. Docs must say so plainly (as today)
   and must not reference Vercel or production setup.
7. Keep the existing page slugs `introduction` and `quickstart` working (reuse
   them; don't rename — external links and llms.txt already point there).
8. The docs directory is also served raw (files are downloadable at their
   path). Don't put working notes or this plan inside `docs/`.

## 3. The rubric being targeted

Distilled from Mintlify's own technical-writing guide and API-docs
recommendations (sources in §9). "Great" means all of the following:

- **R1 — Diátaxis coverage**: all four content types present and unmixed:
  tutorial (quickstart), how-to guides (task-shaped), reference (exact,
  scannable), explanation (concepts/why). Pages never lecture inside a
  reference or detour into theory inside a tutorial.
- **R2 — Runnable-as-pasted examples**: every code sample uses real data and
  executes verbatim against a locally running Binder. No `<string>`, no `123`,
  no `<your-id-here>` in generated samples where the spec can supply examples.
- **R3 — Self-contained pages**: each page makes sense fetched alone (AI
  agents cannot infer context). Each page states what it covers in the
  frontmatter `description` (this feeds `llms.txt`), and repeats minimal
  essentials (base URL, no-auth) rather than assuming the reader saw another
  page.
- **R4 — Error handling as first-class content**: every error code documented
  with *what to do about it*, not just a table.
- **R5 — Changelog as first-class content**: timestamped, discoverable,
  linked to concrete changes.
- **R6 — One term per concept, everywhere**: catalog, card, holding, binder,
  trade list, finish, snapshot, pull (demo). Never introduce synonyms
  ("inventory", "deck", "collection API", "printing" as a synonym for card).
- **R7 — Navigation shallow and intent-ordered**: foundational before edge
  cases, nothing buried, no overloaded groups, descriptive (never clever)
  titles.
- **R8 — Interactive layer**: the OpenAPI playground stays first-class; the
  capped demo endpoint is the promoted "try it with zero setup" path.
- **R9 — Current content only**: nothing stale. Stale text is a bug (agents
  can't tell stale from fresh).
- **R10 — Proportionality**: the API has 7 endpoints. Great docs for a small
  API are small. Do not pad. Every page must earn its place; if a planned page
  turns out thin, fold it into a neighbor and say so in the summary.

## 4. Target information architecture

Two tabs, as today. All pages below are `.mdx` in `docs/`.

```
Tab: Documentation
├─ Getting started
│  ├─ introduction        (rewrite)   [explanation-flavored landing]
│  └─ quickstart          (rewrite)   [tutorial]
├─ Guides                              [how-to]
│  ├─ guides/search-and-paginate      "Search the catalog and paginate it"
│  ├─ guides/price-history            "Track a card's price over time"
│  └─ guides/display-a-binder         "Display a public binder or trade list"
├─ Concepts                            [explanation]
│  ├─ concepts/catalog                "How the catalog works"
│  └─ concepts/prices                 "Prices, finishes, and snapshots"
└─ Reference
   ├─ reference/conventions           "Errors, rate limits, caching, CORS"
   └─ reference/changelog             "API changelog"

Tab: API reference        (auto-generated from openapi.json — unchanged shape)
```

Rationale against the rubric: R1 (all four quadrants), R7 (2 levels deep,
intent-ordered groups), R10 (7 content pages total for 7 endpoints — right-
sized). Do not add more groups or pages.

## 5. Page-by-page specification

General rules for every page:
- Frontmatter `title` + `description` (one sentence, concrete, written to be
  read out of context in `llms.txt`).
- H2/H3 hierarchy only; headings state the thing ("Paginate with cursors"),
  never tease ("Going further").
- Recurring example cast — use these consistently on every page (R2, R6):
  - Pokémon: `Charizard`, card id `base1-4`, Base Set, `$300.00`
  - MTG: `Lightning Bolt`, `m10` Magic 2010, `$2.50`
  - Binder id example: `3c90c3cc-0d44-4b50-8888-8dd25736052a`
  - Trade token example: same UUID shape
- Every curl sample targets `http://localhost:3000` and runs verbatim.
- Link related pages inline (agents and humans both navigate by links), but
  never require another page to understand this one (R3).

### 5.1 `introduction.mdx` (rewrite)
Keep the current page's substance — it's factually right — but restructure:
- What the API is: read-only, no auth, JSON, CORS-open; serves Binder's own
  layer (binders, trade lists, catalog, our price history), deliberately not
  an upstream card/price passthrough. Attribution paragraph stays (constraint
  §2.2).
- Fix the stale line: the API returns resources that are public — a binder its
  owner made public, or a trade list (**always public by design**).
- The endpoint table stays (it's a good agent-facing map) — add the demo
  endpoint row.
- End with three links: quickstart, conventions, API reference tab.
- Cut: anything tutorial-shaped (belongs in quickstart).

### 5.2 `quickstart.mdx` (rewrite as a true tutorial)
Linear, numbered, zero choices (R1): run the app → make a binder public → one
curl per endpoint in a fixed order (binder → binder history → trade list →
catalog search → card → card history → demo pull) → "where next" (guides,
conventions). Trim the current page's "Notes" section entirely — that content
moves to `reference/conventions`. Keep every response example real and
consistent with the spec's examples (§6).

### 5.3 `guides/search-and-paginate.mdx`
Problem→solution (R1): find a card, filter by game, then walk the full catalog
with `cursor`/`has_more`/`next_cursor`. Include one complete pagination loop in
bash (curl + jq) and one in JavaScript (fetch). State the `limit` bounds
(1–100, default 50) and that `count` is page-size, not total. Mention the
"100 results is really 100+" upstream-cap nuance ONLY if verified in code;
otherwise omit.

### 5.4 `guides/price-history.mdx`
Task: chart a card's price over 30 days. Use `GET
/api/v1/cards/{game}/{id}/history?days=30`; explain `days` bounds (1–365,
default 30), one point per day, and that history exists only for cards someone
tracks (404 otherwise → link to concepts/catalog). One complete example:
fetch + transform into `[{day, price_usd}]` pairs in JavaScript.

### 5.5 `guides/display-a-binder.mdx`
Task: render someone's public binder or trade list on your own site. Covers:
getting the id/token from share links, fetching, `finish` (value foils against
`usd_foil`), `for_trade` flag, `image_url` being absolute and fetchable
cross-origin, and a note to keep the `attribution` string visible in any UI
built on this data (constraint §2.2). One compact HTML+JS example that renders
a binder's cards as a list.

### 5.6 `concepts/catalog.mdx`
Explanation (R1): the catalog is every distinct card any Binder user tracks —
normalized to one cross-game model; it grows with usage and is NOT an
exhaustive index of every card ever printed (link upstream sources for that,
keeping everyone inside their terms). Explain the card identity model
(`game` + `card_id`, ids are upstream-native: Scryfall UUIDs, PokéWallet ids,
OPTCG ids). Explain why holdings/owners never leak through the catalog.

### 5.7 `concepts/prices.mdx`
Explanation: where prices come from (upstream, daily), what `usd` vs
`usd_foil` vs `eur` mean, **null means "no price known", never zero**, what a
snapshot is (Binder's own daily job → our history endpoints), daily
granularity, and why history starts when the first user tracks the card.

### 5.8 `reference/conventions.mdx`
The one-fetch rules page (R3, R4). Scannable sections:
- **Errors**: the envelope `{ "error": { "code", "message" } }`; a table of
  all four codes (`invalid_request`, `not_found`, `rate_limited`, `internal`)
  with *what to do* for each (fix the request / check id + whether the
  resource is public / back off per Retry-After / retry later + it's logged).
  Note 404 deliberately covers both "doesn't exist" and "not public".
- **Rate limits**: 60 GET/min/IP on `/api/v1/*` → 429 + `Retry-After`; the
  demo endpoint's separate 3 pulls/IP/day cap.
- **Caching**: `Cache-Control: public, max-age=300`, weak `ETag` on every v1
  GET, `If-None-Match` → 304; demo endpoint is `no-store`.
- **Pagination**: opaque cursors, `has_more`/`next_cursor`, cursors expire
  never but are opaque — don't parse them.
- **CORS**: open (`*`), GET/OPTIONS only.
- **Attribution**: every response carries `attribution`; keep it visible in
  UIs built on the data.

### 5.9 `reference/changelog.mdx`
Use Mintlify `<Update>` components, newest first. Derive real entries from
`git log --follow docs/openapi.json` and CLAUDE.md phase notes; expected
shape: 1.4.0 (capped demo playground endpoint), 1.3.0 (per-card history
endpoint `?days=`), 1.2.0 (cursor pagination, error envelope, ETag/304, rate
limiting), 1.x/1.0 (initial public surface). Verify version-to-change mapping
from git history before writing; label with dates from the commits.

## 6. OpenAPI spec upgrades (`docs/openapi.json`)

This is the highest-leverage work (R2). The generated endpoint pages and
playground prefills come from here.

1. **Add `example` values to every schema property and parameter.** Use the
   recurring cast (§5). Cover: `Game` (`"pokemon"`), `Price`
   (`{"usd": 300, "usd_foil": null, "eur": null}`), `Card`/`CatalogCard`
   (Charizard base1-4 end-to-end), cursors (a realistic opaque base64url
   string), `PricePoint`/`HistoryPoint` (real ISO dates), `attribution` (the
   actual string from `src/lib/publicApi.ts`, verbatim), error examples per
   code.
2. **Add full response `examples`** (media-type level) for every 200 and every
   4XX so the right-hand panel shows a complete realistic body instead of a
   skeleton.
3. **Audit against code** (constraint §2.5): parameters, bounds, required
   fields, `finish` enum, nullable fields, headers (`Retry-After`, `ETag`).
   Fix any drift found; list every fix in your final summary.
4. Add a 4XX response to the `/api/v1/openapi.json` GET operation if code
   supports one; if the route genuinely can't 4XX, leave it and note why.
5. Bump `info.version` to `1.5.0` (docs/examples release; no behavior change)
   and add the changelog page's existence to `info.description` only if it
   reads naturally — don't force it.
6. Re-validate: `python3 -m json.tool docs/openapi.json`, then
   `npx tsc --noEmit`, then `npm test` (the `publicApi.test.ts` suite must
   stay green).

## 7. `docs/docs.json` changes

Keep everything already configured (theme, colors, logo, `api.playground`
interactive + `proxy: false`, `api.examples` bash/python/javascript +
`prefill`, `contextual.options`, `seo`, global anchors, footer). Change only:

1. `navigation.tabs[0].groups` → the four groups from §4 with the new page
   slugs.
2. Add feedback affordances (repo is public):
   `"feedback": { "thumbsRating": true, "suggestEdit": true, "raiseIssue": true }`.
3. Nothing else. Do not touch the API reference tab config.

## 8. Execution order & verification

Work in this order (each step leaves the docs consistent):
1. Read ground truth: `CLAUDE.md`, all v1 route files, `publicApi.ts`,
   `proxy.ts`, demo route, current two mdx pages, current spec.
2. OpenAPI upgrades (§6) + validations.
3. `reference/conventions.mdx` (other pages link to it).
4. Rewrites: `introduction.mdx`, `quickstart.mdx`.
5. Guides (§5.3–5.5) — run every code sample against the local dev server
   (`npm run dev` may already be running on :3000; check before starting a
   second one) and paste real captured output into the docs, trimmed for
   length but not fabricated. If a sample can't be run (e.g. empty local
   catalog for a given query), adjust the sample to one that does run.
6. Concepts (§5.6–5.7), changelog (§5.9).
7. `docs.json` navigation last (so a half-done state never ships broken nav).
8. Final gate, in order: `python3 -m json.tool` both JSON files;
   `npx tsc --noEmit`; `npm test`; if an LTS Node is available,
   `cd docs && mint broken-links`. Then a link-check by grep: every internal
   href in the mdx files must match a page in `docs.json` navigation.
9. Report to the user: what changed per file, every spec-vs-code fix from
   §6.3, samples that were actually executed vs. only reviewed, and the exact
   `git add` list for the commit. Suggested message:
   `docs: full rewrite — guides, concepts, conventions, changelog, real spec examples`.
   Remind the user that rendering verification happens on the deployed site
   after push (local `mint dev` is blocked on Node 25), and offer to verify
   the live site (including `llms.txt` picking up the new descriptions) after
   they push.

## 9. Sources the rubric was distilled from

- Mintlify technical writing guide: https://mintlify.com/guides/introduction
  (content types: /guides/content-types, navigation: /guides/navigation)
- Mintlify API documentation recommendations:
  https://www.mintlify.com/library/our-recommendations-for-creating-api-documentation-with-examples
- Mintlify API playground / OpenAPI setup docs:
  https://mintlify.com/docs/api-playground/overview
- Deployed site to compare against: https://binder-23234d81.mintlify.site/
