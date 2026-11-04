"""HTTP client and HTML parsing for the TİTCK on-duty pharmacy page on e-Devlet."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import requests
from bs4 import BeautifulSoup, Tag

from config import (
    COORD_MAX_RETRIES,
    DEFAULT_HEADERS,
    MAX_RETRIES,
    REQUEST_TIMEOUT_SECONDS,
    RETRY_BACKOFF_SECONDS,
    TITCK_BASE_URL,
    TITCK_RESULTS_URL,
    TITCK_SUBMIT_URL,
)
from dates import TURKEY_TZ

LATITUDE_PATTERN = re.compile(r"var latti = parseFloat\((-?[\d.]+)\);")
LONGITUDE_PATTERN = re.compile(r"var longi = parseFloat\((-?[\d.]+)\);")
WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True)
class PageContext:
    token: str | None
    available_dates: tuple[str, ...]


@dataclass
class ScrapedPharmacy:
    district: str
    name: str
    address: str
    phone: str
    # Position in the result table; the map endpoint is addressed by it.
    row_index: int
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    lat: float | None = None
    lng: float | None = None

    @property
    def identity(self) -> tuple[str, str, str]:
        return (self.district, self.name, self.address)

    @property
    def has_coordinates(self) -> bool:
        return self.lat is not None and self.lng is not None


def clean_text(value: str) -> str:
    return WHITESPACE.sub(" ", value).strip()


def normalize_phone(raw_phone: str) -> str:
    digits = re.sub(r"\D", "", raw_phone)
    if len(digits) == 11 and digits.startswith("0"):
        return digits
    if len(digits) == 10:
        return f"0{digits}"
    return clean_text(raw_phone)


def parse_shift_time(value: str) -> datetime | None:
    try:
        parsed = datetime.strptime(clean_text(value), "%H:%M %d/%m/%Y")
    except ValueError:
        return None
    return parsed.replace(tzinfo=TURKEY_TZ)


def parse_pharmacy_rows(html: bytes | str) -> list[ScrapedPharmacy]:
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table", {"id": "searchTable"})
    tbody = table.find("tbody") if isinstance(table, Tag) else None
    if not isinstance(tbody, Tag):
        return []

    # The site repeats some pharmacies verbatim; keep one row per pharmacy and
    # widen its window if the copies ever disagree.
    pharmacies: dict[tuple[str, str, str], ScrapedPharmacy] = {}
    for row_index, row in enumerate(tbody.find_all("tr", recursive=False)):
        columns = row.find_all("td", recursive=False)
        if len(columns) < 4:
            continue
        shift = [parse_shift_time(cell.get_text()) for cell in columns[4:6]]
        pharmacy = ScrapedPharmacy(
            district=clean_text(columns[0].get_text()),
            name=clean_text(columns[1].get_text()),
            address=clean_text(columns[2].get_text()),
            phone=normalize_phone(columns[3].get_text()),
            row_index=row_index,
            starts_at=shift[0] if shift else None,
            ends_at=shift[1] if len(shift) > 1 else None,
        )
        existing = pharmacies.get(pharmacy.identity)
        if existing is None:
            pharmacies[pharmacy.identity] = pharmacy
            continue
        existing.starts_at = _earliest(existing.starts_at, pharmacy.starts_at)
        existing.ends_at = _latest(existing.ends_at, pharmacy.ends_at)
    return list(pharmacies.values())


def _earliest(a: datetime | None, b: datetime | None) -> datetime | None:
    return min(a, b) if a and b else a or b


def _latest(a: datetime | None, b: datetime | None) -> datetime | None:
    return max(a, b) if a and b else a or b


def parse_coordinates(html: str) -> tuple[float, float] | None:
    latitude = LATITUDE_PATTERN.search(html)
    longitude = LONGITUDE_PATTERN.search(html)
    if not latitude or not longitude:
        return None
    lat, lng = float(latitude.group(1)), float(longitude.group(1))
    if lat == 0 and lng == 0:
        return None
    return lat, lng


def _backoff(attempt: int) -> None:
    time.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))


class TitckClient:
    """One e-Devlet session. Not thread-safe: the site keeps the last query in
    the session, and coordinate lookups refer to that query's rows."""

    def __init__(self) -> None:
        self._session = requests.Session()
        self._session.headers.update(DEFAULT_HEADERS)

    def close(self) -> None:
        self._session.close()

    def _request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        kwargs.setdefault("timeout", REQUEST_TIMEOUT_SECONDS)
        for attempt in range(MAX_RETRIES):
            try:
                response = self._session.request(method, url, **kwargs)
                response.raise_for_status()
                return response
            except requests.RequestException:
                if attempt == MAX_RETRIES - 1:
                    raise
                _backoff(attempt)
        raise AssertionError("unreachable")

    def fetch_context(self) -> PageContext:
        soup = BeautifulSoup(self._request("GET", TITCK_BASE_URL).content, "lxml")
        token = soup.body.get("data-token") if soup.body else None
        dates = tuple(
            str(element["value"])
            for element in soup.find_all("input", {"name": "nobetTarihi", "type": "radio"})
            if element.get("value")
        )
        return PageContext(token=str(token) if token else None, available_dates=dates)

    def query_city(self, plate_code: int, site_date: str) -> list[ScrapedPharmacy]:
        """Runs the form for one city and returns its rows (empty when the city
        published no list). Raises on transport errors or a missing token."""
        context = self.fetch_context()
        if not context.token:
            raise requests.RequestException("form token missing")
        if site_date not in context.available_dates:
            raise requests.RequestException(f"date {site_date} no longer offered")

        code = str(plate_code)
        self._request(
            "POST",
            TITCK_SUBMIT_URL,
            data={
                "ilkod": code,
                "ilkod-address-il": code,
                "ilkod-address-ilce": "",
                "nobetTarihi": site_date,
                "token": context.token,
                "btn": "Sorgula",
            },
        )
        return parse_pharmacy_rows(self._request("GET", TITCK_RESULTS_URL).content)

    def fetch_coordinates(self, row_index: int) -> tuple[float, float] | None:
        """Coordinates of a row from the most recent `query_city` call."""
        url = f"{TITCK_BASE_URL}?harita=Goster&index={row_index}"
        payload = {"harita": "Goster", "index": str(row_index)}
        for attempt in range(COORD_MAX_RETRIES):
            try:
                coordinates = parse_coordinates(self._request("POST", url, data=payload).text)
                if coordinates:
                    return coordinates
            except requests.RequestException:
                pass
            if attempt < COORD_MAX_RETRIES - 1:
                _backoff(attempt)
        return None
