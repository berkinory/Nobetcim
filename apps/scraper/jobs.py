"""Scrapes one city for one date and persists the outcome."""

from __future__ import annotations

import datetime
import logging
import threading
import time
from dataclasses import dataclass

import requests

from dates import format_site_date
from storage import apply_known_coordinates, record_unsuccessful, save_city_duties
from titck import TitckClient

log = logging.getLogger(__name__)

_local = threading.local()


def _client() -> TitckClient:
    # One session per worker thread: the site ties map lookups to the
    # session's last query, so sessions must never be shared.
    client = getattr(_local, "client", None)
    if client is None:
        client = _local.client = TitckClient()
    return client


@dataclass(frozen=True)
class CityResult:
    plate_code: int
    status: str
    count: int = 0
    geocoded: int = 0
    seconds: float = 0.0


def scrape_city(duty_date: datetime.date, plate_code: int) -> CityResult:
    started = time.monotonic()
    client = _client()
    try:
        pharmacies = client.query_city(plate_code, format_site_date(duty_date))
        if not pharmacies:
            record_unsuccessful(duty_date, plate_code, "empty")
            return CityResult(plate_code, "empty", seconds=time.monotonic() - started)

        apply_known_coordinates(plate_code, pharmacies)
        geocoded = 0
        for pharmacy in pharmacies:
            if pharmacy.has_coordinates:
                continue
            coordinates = client.fetch_coordinates(pharmacy.row_index)
            if coordinates:
                pharmacy.lat, pharmacy.lng = coordinates
                geocoded += 1

        save_city_duties(duty_date, plate_code, pharmacies)
        return CityResult(plate_code, "ok", len(pharmacies), geocoded, time.monotonic() - started)
    except requests.RequestException as error:
        log.warning("city %s request failed: %s", plate_code, error)
        # Start the next city on a fresh session rather than a broken one.
        client.close()
        _local.client = None
        record_unsuccessful(duty_date, plate_code, "failed")
        return CityResult(plate_code, "failed", seconds=time.monotonic() - started)
