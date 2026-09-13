# CalHiFootball

Objective, results-based power ratings and rankings for **California high school
football**. Inspired by the classic CalPreps / hsratings model, but California
only, with an original rating engine.

## Stack

- **Next.js (App Router) + TypeScript** — server-rendered pages for SEO
- **Prisma + SQLite** locally (swap `DATABASE_URL` for Postgres in production)
- **Tailwind CSS** — dense sports-table UI
- **Vitest** — rating engine tests

## Getting started

```bash
npm install
npm run db:push      # create the SQLite schema
npm run seed         # load sample CA teams + games
npm run rate         # compute ratings
npm run dev          # http://localhost:3000
```

## How the rating works

An iterative power rating (see `lib/ratings/engine.ts`). Every team starts at 0;
a team's rating is repeatedly set to the average of `opponentRating + margin`
across its games and recentered to a mean of 0 until it converges. Margin of
victory is capped with diminishing returns, home field is neutralized, and a win
always helps. California teams are ranked; out-of-state opponents are rated (for
schedule strength) but unranked. Full write-up lives at `/about`.

## Data ingestion

Live scores come from the **SBLive / Scorebook Live public GraphQL API**
(`api.scorebooklive.com/v2/graphql`) — the same backend that powers the official
CIF section scoreboards (e.g. `scores.cifss.org`). We query it directly, scoped
to California (`state: CALIFORNIA`, `genderSport: FOOTBALL`, `level: VARSITY`),
and follow cursor pagination to pull every game SBLive has for a date. Team
`name`, `city` (`locationText`), and `mascot` all come from the API.
**MaxPreps and hsratings are never scraped.**

```bash
# Live: one day, all of California
npm run ingest -- sbl 2026-09-05

# Live: an inclusive date range (season backfill)
npm run ingest -- sbl-range 2026-08-21 2026-09-12

# CSV (also available in the UI at /admin)
npm run ingest -- csv ./data/sample-week4.csv week4
```

Ingestion honors `robots.txt`, throttles requests, caches raw payloads under
`data/raw/`, and de-duplicates games by `(season, date, home, away)`. The
adapter lives in [lib/ingest/scorebooklive.ts](lib/ingest/scorebooklive.ts).

### 8-man vs 11-man

8-man and 11-man are ranked as entirely separate competitions. SBLive tags no
format on individual games, but it exposes per-section "8 Man" organizations
(the same buckets SI/CIF scoreboards use). Team format is derived from those
rosters and stored on `Team.format` (`"eight"` | `"eleven"`). The `sbl` ingest
runs this classification automatically; to refresh it (and recompute) on its
own:

```bash
npm run classify        # reclassify 8-man teams from SBLive section orgs + recompute
```

Ratings and ranks are then computed independently per format, and the UI splits
the scoreboard and rankings with an 11-Man / 8-Man toggle.

### Sections and leagues

Teams are organized as **state → section → league → team**. Leagues come from
SBLive's ~265 California football `LEAGUE` organizations (enumerated via
`stateGenderSportOrganizations`); each league's roster is fetched individually
and cached under `data/raw`. `classifyTeams` upserts `League` rows and assigns
each `Team.leagueId`. A league's CIF section and format are derived from its
members' existing classification (robust, versus SBLive's legacy league->section
parent chain), and a team still in `UNK` adopts its league's section. A team is
only placed in a league whose format matches its own. Teams SBLive doesn't
roster into any league stay **Independent** (`leagueId = null`) within their
section. Browse at `/leagues`, view a single league at `/leagues/[slug]`, and
filter rankings by league once a section is selected.

Notes:
- SBLive's coverage of California is real but not exhaustive; it reflects the
  schools/sections that report to SBLive.
- A small set of authoritative CIF corrections (e.g. the Central Section 8-man
  roster) live in `CLASSIFICATION_OVERRIDES` in
  [lib/ingest/scorebooklive.ts](lib/ingest/scorebooklive.ts) and win over SBLive
  org membership.
- Format classification trusts SBLive's 8-man section rosters; a handful of
  teams there occasionally look debatable, but they follow the same source SI
  uses. Cross-format games (an 8-man team vs an 11-man team) are excluded from
  ratings since the two pools aren't comparable.
- CIF sections are derived from SBLive's section organizations (`classifyTeams`).
  The state feed also returns out-of-state opponents of California teams; those
  are detected from each team's `locationText` state, bucketed into `OOS`, and
  left unranked. `npm run cleanup:teams` reconciles both for existing data and
  infers a section for the few California schools SBLive doesn't roster from the
  majority section of their opponents.
- Week numbers are derived from the game date (see `weekForDate`) when the source
  doesn't provide one.

## Project layout

- `app/` — pages (home scoreboard, `/rankings`, `/leagues`, `/leagues/[slug]`, `/teams/[slug]`, `/about`, `/admin`) and the `/api/import` route
- `components/` — scoreboard, rankings table, week nav, format tabs, breadcrumbs
- `lib/ratings/` — rating engine, types, persistence
- `lib/ingest/` — normalizer, CSV parser, Scorebook Live adapter, polite fetcher
- `prisma/` — schema and seed
- `scripts/` — `ingest.ts`, `rate.ts`, `classify-format.ts`, `cleanup-teams.ts`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Run rating engine tests |
| `npm run seed` | Seed sample data |
| `npm run rate [season]` | Recompute ratings |
| `npm run classify [season]` | Reclassify 8-man/11-man teams and recompute |
| `npm run cleanup:teams [season]` | Fix out-of-state teams + infer CIF sections |
| `npm run ingest -- …` | Ingest scores (CSV or section feed) |
