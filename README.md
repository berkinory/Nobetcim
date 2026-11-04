# nobetcim.app

<p align="center">
  <img src="https://raw.githubusercontent.com/berkinory/nobetcim/main/apps/web/public/nobetcim.webp" alt="Nobetcim Logo" width="120"/>
</p>

<p align="center">
  A free and open-source web application to easily find on-duty pharmacies in Turkey.
</p>

<p align="center">
  <a href="https://nobetcim.app" target="_blank"><strong>nobetcim.app »</strong></a>
</p>

## About

**nobetcim.app** shows every on-duty pharmacy in Turkey on one map. Share your
location to list the nearest ones, then call or get directions in one tap. It
is a free, open-source public service.

Data comes from the Ministry of Health (TİTCK) duty lists on e-Devlet. Every
scraped day is kept, so the database is also a history of on-duty pharmacies.

## Stack

| Part            | Technology                                                             |
| --------------- | ---------------------------------------------------------------------- |
| `apps/web`      | Vite, React 19, TanStack Router + Query, Tailwind CSS 4, MapLibre GL 6 |
| `apps/api`      | Bun, Hono, Drizzle ORM. Serves the API and the built web app           |
| `apps/scraper`  | Python 3.13, requests, BeautifulSoup, SQLAlchemy (managed with uv)     |
| `db/migrations` | PostgreSQL schema, applied by the API on start                         |
| Tooling         | Bun workspaces, Turborepo, oxlint, oxfmt, ruff                         |

## Development

Requires Bun, uv and Docker.

```bash
bun install
docker run -d --name nobetcim-db -p 5432:5432 \
  -e POSTGRES_USER=nobetcim -e POSTGRES_PASSWORD=nobetcim -e POSTGRES_DB=nobetcim \
  postgres:16-alpine

cp apps/web/.env.example apps/web/.env.local   # set VITE_MAPTILER_API_KEY
export DATABASE_URL=postgresql://nobetcim:nobetcim@localhost:5432/nobetcim

bun run dev     # api on :3001, web on :5173, scraper loop
```

The MapTiler key only accepts the production origin; the Vite dev server
proxies MapTiler with that origin so local development still works.

Scrape one city on demand: `cd apps/scraper && uv run python manual.py 34`.

### Checks

```bash
bun run lint          # oxlint + ruff
bun run format        # oxfmt + ruff format
bun run typecheck
bun run test
bun run build
```

### Render benchmark

`bun run bench` drives the same pan/zoom gestures on an emulated mid-range
Android phone (412×915, DPR 2.6, 4× CPU throttle) against the live site and a
local production build (`apps/api` on `:3001`), and reports frame times,
long tasks and style/layout cost. `--stress 10000` adds a run with 10k
synthetic pharmacies.

## Data model

- `city`: 81 provinces by plate code.
- `pharmacy`: one row per physical pharmacy, with cached coordinates.
- `duty`: one row per pharmacy per duty date, with the published shift window.
- `city_scrape`: latest scrape outcome per city and date. Empty and failed
  cities are retried with backoff; good lists are refreshed every 6 hours and
  never overwritten by an empty response.

The legacy `pharmacies` and `completed_cities` tables are left untouched by
the `0001_history` migration, which backfills the new tables from them.

## Deployment

Coolify deploys `docker-compose.yml`: `postgres`, `web` (API + static app on
port 1001) and `scraper`. Set `MAPTILER_API_KEY` in the Coolify environment.

## Contributing

Ideas, bug reports and pull requests are welcome.

## Support

<a href="https://github.com/sponsors/berkinory">
  <img src="https://img.shields.io/badge/Sponsor%20on%20GitHub-EA4AAA.svg?style=for-the-badge&logo=GitHub-Sponsors&logoColor=white" alt="Sponsor on GitHub">
</a>

## License

MIT. See `LICENSE`.

## Contact

[![Email](https://img.shields.io/badge/Email-000000?style=for-the-badge&logo=gmail&logoColor=white)](mailto:berk@mirac.dev?subject=[GitHub])
