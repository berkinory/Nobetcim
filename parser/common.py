import json
import os
from datetime import datetime, timedelta, timezone

from city_mapping import get_city_name
from dotenv import load_dotenv
from upstash_redis import Redis

load_dotenv()

REDIS_TTL = 604800  # 7 days
TOTAL_CITIES = 81


def get_redis_client():
    try:
        return Redis(
            url=os.getenv("UPSTASH_REDIS_REST_URL"),
            token=os.getenv("UPSTASH_REDIS_REST_TOKEN"),
        )
    except Exception as e:
        print(f"✗ Redis connection failed: {e}")
        return None


def get_turkish_time():
    turkish_tz = timezone(timedelta(hours=3))
    return datetime.now(timezone.utc).astimezone(turkish_tz)


def format_date(date_obj):
    return date_obj.strftime("%d/%m/%Y")


def get_scrape_dates():
    current = get_turkish_time()
    return [format_date(current), format_date(current + timedelta(days=1))]


def meta_key(date_key):
    return f"{date_key}:meta"


def pharmacies_to_redis(plaka_kodu, pharmacies):
    city_name = get_city_name(plaka_kodu).title()
    return [
        {
            "city": city_name,
            "district": pharmacy.get("İlçe", ""),
            "name": pharmacy.get("Ad", ""),
            "phone": pharmacy.get("Telefon", ""),
            "address": pharmacy.get("Adres", ""),
            "lat": pharmacy.get("Lat"),
            "long": pharmacy.get("Long"),
        }
        for pharmacy in pharmacies
    ]


def merge_city_pharmacies(all_pharmacies, plaka_kodu, pharmacies):
    city_name = get_city_name(plaka_kodu).title()
    kept = [p for p in all_pharmacies if p.get("city") != city_name]
    kept.extend(pharmacies_to_redis(plaka_kodu, pharmacies))
    return kept


def load_scrape_state(redis_client, date_key):
    if not redis_client:
        return [], set()

    pharmacies = []
    completed_cities = set()

    try:
        existing_data = redis_client.get(date_key)
        if existing_data:
            pharmacies = json.loads(existing_data)

        meta = redis_client.get(meta_key(date_key))
        if meta:
            completed_cities = set(json.loads(meta).get("completed_cities", []))
    except Exception as e:
        print(f"✗ Redis load error: {e}")

    return pharmacies, completed_cities


def save_scrape_state(redis_client, date_key, pharmacies, completed_cities):
    if not redis_client:
        return False

    try:
        redis_client.set(
            date_key,
            json.dumps(pharmacies, ensure_ascii=False),
            ex=REDIS_TTL,
        )
        redis_client.set(
            meta_key(date_key),
            json.dumps({"completed_cities": sorted(completed_cities, key=int)}),
            ex=REDIS_TTL,
        )
        return True
    except Exception as e:
        print(f"✗ Redis save error: {e}")
        return False


def redis_has_data(redis_client, date_key):
    _, completed_cities = load_scrape_state(redis_client, date_key)
    return len(completed_cities) >= TOTAL_CITIES
