# nobetcim.app

<p align="center">
  <img src="https://raw.githubusercontent.com/berkinory/nobetcim/main/web/public/nobetcim.webp" alt="Nobetcim Logo" width="120"/>
</p>

<p align="center">
  A free and open-source web application to easily find on-duty pharmacies in Turkey.
</p>

<p align="center">
  <a href="https://nobetcim.app" target="_blank"><strong>nobetcim.app »</strong></a>
</p>

<p align="center">
    <img src="https://img.shields.io/github/license/berkinory/nobetcim?style=social" alt="License">
</p>

## About The Project

**nobetcim.app** is a project that aims to help people who need a pharmacy after hours throughout Turkey. By granting location access, you can see the nearest on-duty pharmacies on an interactive map, access their address and phone information, and get directions.

This project is developed as a completely free and open-source public service.

## Features

-   **Location-Based Search:** Instantly find the nearest on-duty pharmacies to your location.
-   **Interactive Map:** View pharmacies on the map and easily understand their locations.
-   **Pharmacy Details:** Access information such as the name, address, phone number, and distance to your selected pharmacy.
-   **Directions:** Get directions with a single click via Google Maps and Apple Maps.
-   **Mobile-Friendly:** A modern interface that works seamlessly on phones, tablets, and computers.
-   **Open Source:** All code is transparently shared on GitHub.

## Technologies Used

This project was built using modern web and data processing technologies.

| Category            | Technology                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| **Frontend (Web)**  | `Next.js`, `React`, `Tailwind CSS`, `MapLibre GL`, `Drizzle ORM`   |
| **Database**        | `PostgreSQL` (self-hosted via Docker Compose)                      |
| **Backend (Parser)**| `Python`, `PostgreSQL`                                             |

## Project Structure

The project consists of three main parts:

-   `parser/`: A Python script that regularly scrapes on-duty pharmacy data from turkiye.gov.tr and saves it to PostgreSQL. Containerized with Docker.
-   `web/`: The Next.js frontend where users view pharmacies on the map. Reads data from PostgreSQL via Drizzle ORM.
-   `db/`: SQL migrations for the PostgreSQL schema.

## Deployment

All services run on the same Docker network. PostgreSQL is **not** exposed to the host — only `web` and internal services can reach it.

```bash
cp .env.example .env
# set NEXT_PUBLIC_MAPTILER_API_KEY

docker compose up -d --build
```

PostgreSQL credentials are hardcoded in the repo (`nobetcim` / `nobetcim`) and only reachable on the internal Docker network.

To apply SQL migrations manually (e.g. after adding a new file under `db/migrations/`):

```bash
cd web && bun run db:migrate
```

Services:

- `postgres` — internal database (init from `db/migrations/0000_initial.sql`)
- `pharmacy-scraper` — scheduled scraper writing to PostgreSQL
- `web` — Next.js app on port `1001`

## Contributing

Your contributions can help make the project better. You can submit your ideas, bug reports, or code improvements by opening an "issue" or a "pull request".

## Support

If you like this project and want to support its development, you can do so via GitHub Sponsors. Your support will be a great source of motivation for the project's sustainability and the addition of new features.

<a href="https://github.com/sponsors/berkinory">
  <img src="https://img.shields.io/badge/Sponsor%20on%20GitHub-EA4AAA.svg?style=for-the-badge&logo=GitHub-Sponsors&logoColor=white" alt="Sponsor on GitHub">
</a>

## License

This project is licensed under the **MIT License**. See the `LICENSE` file for more information.

## Contact

[![Email](https://img.shields.io/badge/Email-000000?style=for-the-badge&logo=gmail&logoColor=white)](mailto:berk@mirac.dev?subject=[GitHub])

---
