from __future__ import annotations

import datetime
import logging
import signal
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import (
    CITY_WORKER_COUNT,
    PLATE_CODES,
    REFRESH_OK_AFTER_SECONDS,
    RETRY_BASE_SECONDS,
    RETRY_MAX_SECONDS,
    SCHEDULER_ERROR_RETRY_SECONDS,
    SCHEDULER_INTERVAL_SECONDS,
)
from dates import parse_site_date
from db import dispose_pool
from jobs import CityResult, scrape_city
from storage import CityState, load_city_names, load_city_states
from titck import TitckClient

log = logging.getLogger("scraper")

stop_requested = threading.Event()


def request_shutdown(signum, frame) -> None:
    stop_requested.set()


def is_due(state: CityState | None, now: datetime.datetime) -> bool:
    if state is None:
        return True
    age = (now - state.scraped_at).total_seconds()
    if state.status == "ok" and state.attempts == 0:
        return age >= REFRESH_OK_AFTER_SECONDS
    return age >= min(RETRY_BASE_SECONDS * state.attempts, RETRY_MAX_SECONDS)


def due_plate_codes(duty_date: datetime.date) -> list[int]:
    states = load_city_states(duty_date)
    now = datetime.datetime.now(datetime.UTC)
    return [plate for plate in PLATE_CODES if is_due(states.get(plate), now)]


def run_job(duty_date: datetime.date, plate_code: int) -> CityResult | None:
    # Queued jobs bail out once shutdown starts; running ones finish and save.
    if stop_requested.is_set():
        return None
    return scrape_city(duty_date, plate_code)


def process_date(duty_date: datetime.date, city_names: dict[int, str]) -> None:
    pending = due_plate_codes(duty_date)
    if not pending:
        log.info("%s: nothing due", duty_date)
        return

    log.info("%s: scraping %d cities with %d workers", duty_date, len(pending), CITY_WORKER_COUNT)
    totals: dict[str, int] = {"ok": 0, "empty": 0, "failed": 0}
    with ThreadPoolExecutor(max_workers=CITY_WORKER_COUNT) as executor:
        futures = [executor.submit(run_job, duty_date, plate) for plate in pending]
        for future in as_completed(futures):
            result = future.result()
            if result is None:
                continue
            totals[result.status] += 1
            log.info(
                "%s %-14s %-6s %3d pharmacies, %3d geocoded, %.1fs",
                duty_date,
                city_names.get(result.plate_code, result.plate_code),
                result.status,
                result.count,
                result.geocoded,
                result.seconds,
            )
    log.info("%s: done %s", duty_date, totals)


def run_cycle() -> None:
    probe = TitckClient()
    try:
        dates = probe.fetch_context().available_dates
    finally:
        probe.close()
    if not dates:
        log.warning("site offered no dates")
        return

    city_names = load_city_names()
    for site_date in dates:
        if stop_requested.is_set():
            return
        process_date(parse_site_date(site_date), city_names)


def run_scheduler() -> None:
    while not stop_requested.is_set():
        try:
            run_cycle()
            delay = SCHEDULER_INTERVAL_SECONDS
        except Exception:
            log.exception("cycle failed")
            delay = SCHEDULER_ERROR_RETRY_SECONDS
        stop_requested.wait(delay)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)
    try:
        run_scheduler()
    finally:
        dispose_pool()
        log.info("stopped")


if __name__ == "__main__":
    main()
