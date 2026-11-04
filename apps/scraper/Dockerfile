FROM python:3.13-slim-bookworm AS deps
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

FROM python:3.13-slim-bookworm
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 PATH="/app/.venv/bin:$PATH"
RUN adduser --system --uid 1001 scraper
COPY --from=deps /app/.venv ./.venv
COPY --chown=scraper:nogroup *.py ./
USER scraper
CMD ["python", "main.py"]
