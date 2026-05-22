from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any

import requests
from bs4 import BeautifulSoup

from config import (
    COORD_COMPLETION_THRESHOLD,
    COORD_DELAY_SECONDS,
    COORD_FILL_MAX_PASSES,
    COORD_MAX_RETRIES,
    DEFAULT_HEADERS,
    MAX_PLATE_CODE,
    MAX_RETRIES,
    MIN_PLATE_CODE,
    REQUEST_TIMEOUT_SECONDS,
    RETRY_BACKOFF_SECONDS,
    TITCK_BASE_URL,
    TITCK_RESULTS_URL,
    TITCK_SUBMIT_URL,
)

LATITUDE_PATTERN = re.compile(r"var latti = parseFloat\(([\d\.]+)\);")
LONGITUDE_PATTERN = re.compile(r"var longi = parseFloat\(([\d\.]+)\);")

PharmacyRecord = dict[str, Any]
ScrapeResult = dict[str, Any]


@dataclass(frozen=True)
class PageContext:
    token: str | None
    available_dates: tuple[str, ...]


def is_valid_plate_code(plate_code: str) -> bool:
    return plate_code.isdigit() and MIN_PLATE_CODE <= int(plate_code) <= MAX_PLATE_CODE


def normalize_phone_number(raw_phone: str) -> str:
    if not raw_phone:
        return ""

    digits = re.sub(r"[^\d]", "", raw_phone)

    if digits.startswith("0") and len(digits) == 11:
        return digits

    if len(digits) == 10:
        return f"0{digits}"

    return raw_phone


def parse_html(content: bytes | str) -> BeautifulSoup:
    try:
        return BeautifulSoup(content, "lxml")
    except Exception:
        return BeautifulSoup(content, "html.parser")


def sleep_backoff(attempt_index: int) -> None:
    time.sleep(RETRY_BACKOFF_SECONDS * (attempt_index + 1))


def build_scrape_result(
    *,
    success: bool,
    started_at: float,
    pharmacies: list[PharmacyRecord] | None = None,
) -> ScrapeResult:
    records = pharmacies or []
    return {
        "success": success,
        "tooktime": round(time.time() - started_at, 2),
        "count": len(records),
        "list": records,
    }


def build_form_payload(plate_code: str, date_str: str, token: str) -> dict[str, str]:
    return {
        "ilkod": plate_code,
        "ilkod-address-il": plate_code,
        "ilkod-address-ilce": "",
        "nobetTarihi": date_str,
        "token": token,
        "btn": "Sorgula",
    }


class TitckClient:
    def __init__(self) -> None:
        self._session = requests.Session()
        self._session.headers.update(DEFAULT_HEADERS)

    def request(self, url: str, method: str = "GET", **kwargs: Any) -> requests.Response:
        kwargs.setdefault("timeout", REQUEST_TIMEOUT_SECONDS)
        kwargs.setdefault("stream", True)

        for attempt in range(MAX_RETRIES):
            try:
                if method.upper() == "GET":
                    response = self._session.get(url, **kwargs)
                else:
                    response = self._session.post(url, **kwargs)

                response.raise_for_status()
                return response
            except requests.RequestException:
                if attempt == MAX_RETRIES - 1:
                    raise
                sleep_backoff(attempt)

        raise requests.RequestException("request failed")

    def fetch_page_context(self) -> PageContext:
        response = self.request(TITCK_BASE_URL, stream=False)
        soup = parse_html(response.content)
        token = soup.body.get("data-token") if soup.body else None
        available_dates = tuple(
            element.get("value")
            for element in soup.find_all("input", {"name": "nobetTarihi", "type": "radio"})
            if element.get("value")
        )
        response.close()
        return PageContext(token=token, available_dates=available_dates)

    def submit_city_query(self, plate_code: str, date_str: str, token: str) -> None:
        payload = build_form_payload(plate_code, date_str, token)
        response = self.request(TITCK_SUBMIT_URL, method="POST", data=payload, stream=False)
        response.close()

    def fetch_result_rows(self) -> list[Any]:
        response = self.request(TITCK_RESULTS_URL, stream=False)
        soup = parse_html(response.content)
        table = soup.find("table", {"id": "searchTable"})
        tbody = table.find("tbody") if table else None
        rows = tbody.find_all("tr") if tbody else []
        response.close()
        return rows

    def fetch_coordinates(self, row_index: int) -> tuple[float | None, float | None]:
        url = f"{TITCK_BASE_URL}?harita=Goster&index={row_index}"
        payload = {"harita": "Goster", "index": str(row_index)}

        for attempt in range(COORD_MAX_RETRIES):
            try:
                response = self.request(url, method="POST", data=payload, stream=False)
                content = response.text
                response.close()

                if COORD_DELAY_SECONDS:
                    time.sleep(COORD_DELAY_SECONDS)

                latitude = LATITUDE_PATTERN.search(content)
                longitude = LONGITUDE_PATTERN.search(content)
                if latitude and longitude:
                    return float(latitude.group(1)), float(longitude.group(1))

                if attempt < COORD_MAX_RETRIES - 1:
                    sleep_backoff(attempt)
            except requests.RequestException:
                if attempt < COORD_MAX_RETRIES - 1:
                    sleep_backoff(attempt)

        return None, None


def parse_pharmacy_rows(rows: list[Any]) -> list[PharmacyRecord]:
    pharmacies: list[PharmacyRecord] = []

    for row_index, row in enumerate(rows):
        columns = row.find_all("td", recursive=False)
        if len(columns) < 4:
            continue

        phone_cell = "".join(columns[3].find_all(string=True, recursive=False)).strip()
        pharmacies.append(
            {
                "Ad": columns[1].get_text(strip=True),
                "İlçe": columns[0].get_text(strip=True),
                "Adres": columns[2].get_text(strip=True),
                "Telefon": normalize_phone_number(phone_cell),
                "Lat": None,
                "Long": None,
                "_index": row_index,
            }
        )

    return pharmacies


def has_coordinates(pharmacy: PharmacyRecord) -> bool:
    return bool(pharmacy.get("Lat") and pharmacy.get("Long"))


def fill_missing_coordinates(client: TitckClient, pharmacies: list[PharmacyRecord]) -> list[PharmacyRecord]:
    if not pharmacies:
        return pharmacies

    for _ in range(COORD_FILL_MAX_PASSES):
        missing = [pharmacy for pharmacy in pharmacies if not has_coordinates(pharmacy)]
        if not missing:
            break

        for pharmacy in missing:
            latitude, longitude = client.fetch_coordinates(pharmacy["_index"])
            if latitude is not None and longitude is not None:
                pharmacy["Lat"] = latitude
                pharmacy["Long"] = longitude

        completion_rate = sum(has_coordinates(p) for p in pharmacies) / len(pharmacies) * 100
        if completion_rate >= COORD_COMPLETION_THRESHOLD:
            break

    for pharmacy in pharmacies:
        pharmacy.pop("_index", None)

    return pharmacies


class ScrapeSession:
    def __init__(self, date_str: str) -> None:
        self.date_str = date_str
        self.submit_date: str | None = None
        self.token: str | None = None
        self.available_dates: tuple[str, ...] = ()
        self._client = TitckClient()

    def start(self) -> bool:
        self.refresh_context()

        if not self.token or self.date_str not in self.available_dates:
            return False

        self.submit_date = self.date_str
        return True

    def refresh_context(self) -> None:
        context = self._client.fetch_page_context()
        self.token = context.token
        self.available_dates = context.available_dates

    def scrape_city(self, plate_code: str, max_retries: int = MAX_RETRIES) -> ScrapeResult:
        started_at = time.time()

        for attempt in range(max_retries):
            try:
                self.refresh_context()

                if not self.token or self.submit_date not in self.available_dates:
                    return build_scrape_result(success=False, started_at=started_at)

                self._client.submit_city_query(plate_code, self.submit_date, self.token)
                rows = self._client.fetch_result_rows()
                pharmacies = parse_pharmacy_rows(rows)

                if not pharmacies:
                    if attempt < max_retries - 1:
                        sleep_backoff(attempt)
                        continue
                    return build_scrape_result(success=True, started_at=started_at)

                pharmacies = fill_missing_coordinates(self._client, pharmacies)
                return build_scrape_result(success=True, started_at=started_at, pharmacies=pharmacies)

            except requests.RequestException:
                if attempt < max_retries - 1:
                    sleep_backoff(attempt)
                    continue
                return build_scrape_result(success=False, started_at=started_at)

        return build_scrape_result(success=False, started_at=started_at)


def scrape_pharmacies(
    plate_code: str,
    date_str: str,
    session: ScrapeSession | None = None,
) -> ScrapeResult:
    owns_session = session is None

    if owns_session:
        session = ScrapeSession(date_str)
        if not session.start():
            return build_scrape_result(success=False, started_at=time.time())

    return session.scrape_city(plate_code)


def parser(plate_code: str, date_str: str, scrape_session: ScrapeSession | None = None) -> ScrapeResult:
    try:
        if not is_valid_plate_code(plate_code):
            return build_scrape_result(success=False, started_at=time.time())

        return scrape_pharmacies(plate_code, date_str, session=scrape_session)
    except (IndexError, KeyboardInterrupt):
        raise
    except Exception:
        return build_scrape_result(success=False, started_at=time.time())


if __name__ == "__main__":
    from dates import format_scrape_date, get_turkey_now

    today = format_scrape_date(get_turkey_now())
    print(parser("34", today))
