import requests
from bs4 import BeautifulSoup
import re
import time
from functools import wraps
import gc

BASE_URL = "https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama"

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    "Referer": BASE_URL,
    "Connection": "keep-alive",
    "Accept-Encoding": "gzip, deflate",
}

session = requests.Session()
session.headers.update(HEADERS)


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
    kwargs.setdefault("timeout", 5)
    kwargs.setdefault("stream", True)
    if method.upper() == "GET":
        response = session.get(url, **kwargs)
    else:
        response = session.post(url, **kwargs)
    response.raise_for_status()
    return response


def fetch_token() -> str:
    response = make_request(BASE_URL, stream=False)
    try:
        soup = BeautifulSoup(response.content, "lxml")
    except:
        soup = BeautifulSoup(response.content, "html.parser")
    
    token = soup.body.get("data-token") if soup.body else None
    response.close()
    del soup, response
    gc.collect()
    return token


def submit_query(plaka_kodu: str, tarih: str, token: str) -> None:
    payload = {
        "plakaKodu": plaka_kodu,
        "nobetTarihi": tarih,
        "token": token,
        "btn": "Sorgula",
    }
    response = make_request(f"{BASE_URL}?submit", method="POST", data=payload, stream=False)
    response.close()
    del response
    gc.collect()


def fetch_pharmacy_rows() -> list:
    response = make_request(f"{BASE_URL}?nobetci=Eczaneler", stream=False)
    try:
        soup = BeautifulSoup(response.content, "lxml")
    except:
        soup = BeautifulSoup(response.content, "html.parser")
    
    table = soup.find("table", {"id": "searchTable"})
    rows = table.find("tbody").find_all("tr") if table else []
    
    response.close()
    del soup, response, table
    gc.collect()
    return rows


def get_coordinates(index: int, max_retries=3):
    url_coord = f"{BASE_URL}?harita=Goster&index={index}"
    payload = {"harita": "Goster", "index": str(index)}

    for attempt in range(max_retries):
        try:
            response = make_request(url_coord, method="POST", data=payload, stream=False)
            content = response.text
            response.close()
            
            time.sleep(1)

            lat_match = re.search(r"var latti = parseFloat\(([\d\.]+)\);", content)
            lon_match = re.search(r"var longi = parseFloat\(([\d\.]+)\);", content)

            del response, content
            gc.collect()

            if lat_match and lon_match:
                return float(lat_match.group(1)), float(lon_match.group(1))
            else:
                if attempt < max_retries - 1:
                    backoff_delay = (attempt + 1) * 2 
                    time.sleep(backoff_delay)
                    continue
                else:
                    return None, None
                    
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep((attempt + 1) * 2)
                continue
            else:
                return None, None
    
    return None, None


def is_suspicious_empty_result(plaka_kodu):
    return True


def scrape_pharmacies(plaka_kodu: str, tarih: str, max_retries=3) -> dict:
    start_time = time.time()
    
    for attempt in range(max_retries):
        pharmacies = []
        
        try:
            token = fetch_token()
            time.sleep(1)
            submit_query(plaka_kodu, tarih, token)
            time.sleep(1)
            rows = fetch_pharmacy_rows()

            for idx, row in enumerate(rows):
                cols = [td.get_text(strip=True) for td in row.find_all("td")]
                if len(cols) >= 4:
                    name = cols[0]
                    district = cols[1].split(" ")[0]
                    phone = clean_phone_number(cols[2])
                    address = cols[3]

                    lat, lon = get_coordinates(idx)
                    
                    pharmacy_data = {
                        "Ad": name,
                        "İlçe": district,
                        "Adres": address,
                        "Telefon": phone,
                        "Lat": lat,
                        "Long": lon,
                    }
                    pharmacies.append(pharmacy_data)
                    
                    del cols, pharmacy_data
                
                del row

            del rows, token
            gc.collect()

            if len(pharmacies) == 0:
                if attempt < max_retries - 1:
                    backoff_delay = 5 * (attempt + 1) 
                    time.sleep(backoff_delay)
                    continue
                else:
                    return {
                        "success": True,
                        "tooktime": round(time.time() - start_time, 2),
                        "count": 0,
                        "list": [],
                    }
            else:
                missing_coords = sum(1 for p in pharmacies if not p.get("Lat") or not p.get("Long"))
                coord_percentage = (len(pharmacies) - missing_coords) / len(pharmacies) * 100
                
                if coord_percentage < 50 and attempt < max_retries - 1:
                    backoff_delay = 5 * (attempt + 1)
                    time.sleep(backoff_delay)
                    continue
                else:
                    return {
                        "success": True,
                        "tooktime": round(time.time() - start_time, 2),
                        "count": len(pharmacies),
                        "list": pharmacies,
                    }

        except Exception as e:
            if attempt < max_retries - 1:
                backoff_delay = 5 * (attempt + 1)  # 5s, 10s, 15s
                time.sleep(backoff_delay)
                continue
            else:
                del pharmacies
                gc.collect()
                return {
                    "success": False,
                    "tooktime": round(time.time() - start_time, 2),
                    "count": 0,
                    "list": [],
                }
    
    # Should not reach here, but just in case
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
            result = scrape_pharmacies(plaka_kodu, tarih)
            gc.collect()
            return result

    except (IndexError, KeyboardInterrupt, Exception):
        gc.collect()
        return {"success": False, "tooktime": 0, "count": 0, "list": []}

if __name__ == "__main__":
    print(parser("2", "13/06/2025"))