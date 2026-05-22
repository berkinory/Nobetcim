import re
import time

import requests
from bs4 import BeautifulSoup

from common import (
    COORD_DELAY,
    COORD_MAX_RETRIES,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF,
)

BASE_URL = "https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama"

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    "Referer": BASE_URL,
    "Connection": "keep-alive",
    "Accept-Encoding": "gzip, deflate",
}


def clean_phone_number(phone_text):
    if not phone_text:
        return ""

    digits_only = re.sub(r"[^\d]", "", phone_text)

    if digits_only.startswith("0") and len(digits_only) == 11:
        return digits_only

    if len(digits_only) == 10:
        return "0" + digits_only

    return phone_text


def parse_html(content):
    try:
        return BeautifulSoup(content, "lxml")
    except Exception:
        return BeautifulSoup(content, "html.parser")


def make_request(http, url: str, method: str = "GET", **kwargs) -> requests.Response:
    kwargs.setdefault("timeout", REQUEST_TIMEOUT)
    kwargs.setdefault("stream", True)

    for attempt in range(MAX_RETRIES):
        try:
            if method.upper() == "GET":
                response = http.get(url, **kwargs)
            else:
                response = http.post(url, **kwargs)
            response.raise_for_status()
            return response
        except requests.RequestException:
            if attempt == MAX_RETRIES - 1:
                raise
            time.sleep(RETRY_BACKOFF * (attempt + 1))

    raise requests.RequestException("request failed")


def fetch_page_context(http):
    response = make_request(http, BASE_URL, stream=False)
    soup = parse_html(response.content)
    token = soup.body.get("data-token") if soup.body else None
    available_dates = [
        inp.get("value")
        for inp in soup.find_all("input", {"name": "nobetTarihi", "type": "radio"})
        if inp.get("value")
    ]
    response.close()
    return token, available_dates


def submit_query(http, plaka_kodu: str, tarih: str, token: str) -> None:
    payload = {
        "ilkod": plaka_kodu,
        "ilkod-address-il": plaka_kodu,
        "ilkod-address-ilce": "",
        "nobetTarihi": tarih,
        "token": token,
        "btn": "Sorgula",
    }
    response = make_request(http, f"{BASE_URL}?submit", method="POST", data=payload, stream=False)
    response.close()


def fetch_pharmacy_rows(http) -> list:
    response = make_request(http, f"{BASE_URL}?nobetci=Eczaneler", stream=False)
    soup = parse_html(response.content)
    table = soup.find("table", {"id": "searchTable"})
    rows = table.find("tbody").find_all("tr") if table and table.find("tbody") else []
    response.close()
    return rows


def get_coordinates(http, index: int):
    url_coord = f"{BASE_URL}?harita=Goster&index={index}"
    payload = {"harita": "Goster", "index": str(index)}

    for attempt in range(COORD_MAX_RETRIES):
        try:
            response = make_request(http, url_coord, method="POST", data=payload, stream=False)
            content = response.text
            response.close()

            if COORD_DELAY:
                time.sleep(COORD_DELAY)

            lat_match = re.search(r"var latti = parseFloat\(([\d\.]+)\);", content)
            lon_match = re.search(r"var longi = parseFloat\(([\d\.]+)\);", content)

            if lat_match and lon_match:
                return float(lat_match.group(1)), float(lon_match.group(1))

            if attempt < COORD_MAX_RETRIES - 1:
                time.sleep(RETRY_BACKOFF * (attempt + 1))
        except requests.RequestException:
            if attempt < COORD_MAX_RETRIES - 1:
                time.sleep(RETRY_BACKOFF * (attempt + 1))

    return None, None


def parse_pharmacy_rows(rows):
    pharmacies = []

    for idx, row in enumerate(rows):
        cols = row.find_all("td", recursive=False)
        if len(cols) < 4:
            continue

        pharmacies.append(
            {
                "Ad": cols[1].get_text(strip=True),
                "İlçe": cols[0].get_text(strip=True),
                "Adres": cols[2].get_text(strip=True),
                "Telefon": clean_phone_number(
                    "".join(cols[3].find_all(string=True, recursive=False)).strip()
                ),
                "Lat": None,
                "Long": None,
                "_index": idx,
            }
        )

    return pharmacies


def fill_missing_coordinates(http, pharmacies, max_passes=3):
    if not pharmacies:
        return pharmacies

    for _ in range(max_passes):
        missing = [
            pharmacy
            for pharmacy in pharmacies
            if not pharmacy.get("Lat") or not pharmacy.get("Long")
        ]
        if not missing:
            break

        for pharmacy in missing:
            lat, lon = get_coordinates(http, pharmacy["_index"])
            if lat is not None and lon is not None:
                pharmacy["Lat"] = lat
                pharmacy["Long"] = lon

        with_coords = sum(1 for p in pharmacies if p.get("Lat") and p.get("Long"))
        if with_coords / len(pharmacies) * 100 >= 50:
            break

    for pharmacy in pharmacies:
        pharmacy.pop("_index", None)

    return pharmacies


class ScrapeSession:
    def __init__(self, tarih: str):
        self.tarih = tarih
        self.submit_date = None
        self.token = None
        self.available_dates = []
        self.http = requests.Session()
        self.http.headers.update(HEADERS)

    def start(self):
        self.refresh_context()
        if not self.token:
            return False

        if self.tarih not in self.available_dates:
            return False

        self.submit_date = self.tarih
        return True

    def refresh_context(self):
        self.token, self.available_dates = fetch_page_context(self.http)

    def scrape_city(self, plaka_kodu: str, max_retries=MAX_RETRIES) -> dict:
        start_time = time.time()

        for attempt in range(max_retries):
            try:
                self.refresh_context()
                if not self.token or self.submit_date not in self.available_dates:
                    return {
                        "success": False,
                        "tooktime": round(time.time() - start_time, 2),
                        "count": 0,
                        "list": [],
                    }

                submit_query(self.http, plaka_kodu, self.submit_date, self.token)
                rows = fetch_pharmacy_rows(self.http)
                pharmacies = parse_pharmacy_rows(rows)

                if not pharmacies:
                    if attempt < max_retries - 1:
                        time.sleep(RETRY_BACKOFF * (attempt + 1))
                        continue

                    return {
                        "success": True,
                        "tooktime": round(time.time() - start_time, 2),
                        "count": 0,
                        "list": [],
                    }

                pharmacies = fill_missing_coordinates(self.http, pharmacies)

                return {
                    "success": True,
                    "tooktime": round(time.time() - start_time, 2),
                    "count": len(pharmacies),
                    "list": pharmacies,
                }

            except requests.RequestException:
                if attempt < max_retries - 1:
                    time.sleep(RETRY_BACKOFF * (attempt + 1))
                    continue

                return {
                    "success": False,
                    "tooktime": round(time.time() - start_time, 2),
                    "count": 0,
                    "list": [],
                }

        return {
            "success": False,
            "tooktime": round(time.time() - start_time, 2),
            "count": 0,
            "list": [],
        }


def scrape_pharmacies(plaka_kodu: str, tarih: str, scrape_session=None) -> dict:
    owns_session = scrape_session is None

    if owns_session:
        scrape_session = ScrapeSession(tarih)
        if not scrape_session.start():
            return {"success": False, "tooktime": 0, "count": 0, "list": []}

    return scrape_session.scrape_city(plaka_kodu)


def parser(plaka_kodu: str, tarih: str, scrape_session=None) -> dict:
    try:
        if not plaka_kodu.isdigit() or not (1 <= int(plaka_kodu) <= 81):
            return {"success": False, "tooktime": 0, "count": 0, "list": []}

        return scrape_pharmacies(plaka_kodu, tarih, scrape_session=scrape_session)
    except (IndexError, KeyboardInterrupt):
        raise
    except Exception:
        return {"success": False, "tooktime": 0, "count": 0, "list": []}


if __name__ == "__main__":
    from common import format_date, get_turkish_time

    today = format_date(get_turkish_time())
    print(parser("34", today))
