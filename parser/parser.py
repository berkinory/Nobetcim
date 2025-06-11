import requests
from bs4 import BeautifulSoup
import re
import time
from functools import wraps

BASE_URL = "https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama"

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    "Referer": BASE_URL,
}

session = requests.Session()


def clean_phone_number(phone_text):
    if not phone_text:
        return ""

    digits_only = re.sub(r"[^\d]", "", phone_text)

    if digits_only.startswith("0") and len(digits_only) == 11:
        return digits_only

    if len(digits_only) == 10:
        return "0" + digits_only

    return phone_text


def retry_on_failure(retries=5):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, retries + 1):
                try:
                    return func(*args, **kwargs)
                except requests.RequestException:
                    if attempt == retries:
                        raise
                    time.sleep(5)
            return None

        return wrapper

    return decorator


@retry_on_failure()
def make_request(url: str, method: str = "GET", **kwargs) -> requests.Response:
    kwargs.setdefault("timeout", 6)
    if method.upper() == "GET":
        response = session.get(url, **kwargs)
    else:
        response = session.post(url, **kwargs)
    response.raise_for_status()
    return response


def fetch_token() -> str:
    response = make_request(BASE_URL, headers=HEADERS)
    soup = BeautifulSoup(response.text, "html.parser")
    return soup.body.get("data-token")


def submit_query(plaka_kodu: str, tarih: str, token: str) -> None:
    payload = {
        "plakaKodu": plaka_kodu,
        "nobetTarihi": tarih,
        "token": token,
        "btn": "Sorgula",
    }
    make_request(f"{BASE_URL}?submit", method="POST", data=payload, headers=HEADERS)


def fetch_pharmacy_rows() -> list:
    response = make_request(f"{BASE_URL}?nobetci=Eczaneler", headers=HEADERS)
    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table", {"id": "searchTable"})
    return table.find("tbody").find_all("tr") if table else []


def get_coordinates(index: int):
    url_coord = f"{BASE_URL}?harita=Goster&index={index}"
    payload = {"harita": "Goster", "index": str(index)}

    res = make_request(url_coord, method="POST", data=payload, headers=HEADERS)
    time.sleep(2)

    lat_match = re.search(r"var latti = parseFloat\(([\d\.]+)\);", res.text)
    lon_match = re.search(r"var longi = parseFloat\(([\d\.]+)\);", res.text)

    if lat_match and lon_match:
        lat = float(lat_match.group(1))
        lon = float(lon_match.group(1))
        return lat, lon
    else:
        return None, None


def scrape_pharmacies(plaka_kodu: str, tarih: str) -> dict:
    start_time = time.time()

    try:
        token = fetch_token()
        time.sleep(2)
        submit_query(plaka_kodu, tarih, token)
        time.sleep(2)
        rows = fetch_pharmacy_rows()

        pharmacies = []
        for idx, row in enumerate(rows):
            cols = [td.get_text(strip=True) for td in row.find_all("td")]
            if len(cols) >= 4:
                name = cols[0]
                district = cols[1].split(" ")[0]
                phone = clean_phone_number(cols[2])
                address = cols[3]

                lat, lon = get_coordinates(idx)
                pharmacies.append(
                    {
                        "Ad": name,
                        "İlçe": district,
                        "Adres": address,
                        "Telefon": phone,
                        "Lat": lat,
                        "Long": lon,
                    }
                )

        return {
            "success": True,
            "tooktime": round(time.time() - start_time, 2),
            "count": len(pharmacies),
            "list": pharmacies,
        }

    except Exception:
        return {
            "success": False,
            "tooktime": round(time.time() - start_time, 2),
            "count": 0,
            "list": [],
        }


def parser(plaka_kodu: str, tarih: str) -> dict:
    try:
        if not plaka_kodu.isdigit() or not (1 <= int(plaka_kodu) <= 81):
            return {"success": False, "tooktime": 0, "count": 0, "list": []}
        else:
            return scrape_pharmacies(plaka_kodu, tarih)

    except (IndexError, KeyboardInterrupt, Exception):
        return {"success": False, "tooktime": 0, "count": 0, "list": []}
