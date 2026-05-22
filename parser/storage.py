from __future__ import annotations

import json
import os
from typing import Any

from city_mapping import get_city_name
from config import REDIS_TTL_SECONDS, TOTAL_CITY_COUNT
from dotenv import load_dotenv
from upstash_redis import Redis

load_dotenv()

PharmacyRecord = dict[str, Any]
RedisPharmacyRecord = dict[str, Any]


def get_redis_client() -> Redis | None:
    try:
        return Redis(
            url=os.getenv("UPSTASH_REDIS_REST_URL"),
            token=os.getenv("UPSTASH_REDIS_REST_TOKEN"),
        )
    except Exception as error:
        print(f"✗ Redis connection failed: {error}")
        return None


def scrape_meta_key(date_key: str) -> str:
    return f"{date_key}:meta"


def to_redis_records(plate_code: str, pharmacies: list[PharmacyRecord]) -> list[RedisPharmacyRecord]:
    city_name = get_city_name(plate_code).title()
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


def merge_city_records(
    existing_records: list[RedisPharmacyRecord],
    plate_code: str,
    pharmacies: list[PharmacyRecord],
) -> list[RedisPharmacyRecord]:
    city_name = get_city_name(plate_code).title()
    without_city = [record for record in existing_records if record.get("city") != city_name]
    without_city.extend(to_redis_records(plate_code, pharmacies))
    return without_city


def load_scrape_state(redis_client: Redis | None, date_key: str) -> tuple[list[RedisPharmacyRecord], set[str]]:
    if redis_client is None:
        return [], set()

    pharmacies: list[RedisPharmacyRecord] = []
    completed_cities: set[str] = set()

    try:
        existing_data = redis_client.get(date_key)
        if existing_data:
            pharmacies = json.loads(existing_data)

        metadata = redis_client.get(scrape_meta_key(date_key))
        if metadata:
            completed_cities = set(json.loads(metadata).get("completed_cities", []))
    except Exception as error:
        print(f"✗ Redis load error: {error}")

    return pharmacies, completed_cities


def save_scrape_state(
    redis_client: Redis | None,
    date_key: str,
    pharmacies: list[RedisPharmacyRecord],
    completed_cities: set[str],
) -> bool:
    if redis_client is None:
        return False

    try:
        payload = json.dumps(pharmacies, ensure_ascii=False)
        metadata = json.dumps({"completed_cities": sorted(completed_cities, key=int)})

        redis_client.set(date_key, payload, ex=REDIS_TTL_SECONDS)
        redis_client.set(scrape_meta_key(date_key), metadata, ex=REDIS_TTL_SECONDS)
        return True
    except Exception as error:
        print(f"✗ Redis save error: {error}")
        return False


def is_scrape_complete(redis_client: Redis | None, date_key: str) -> bool:
    _, completed_cities = load_scrape_state(redis_client, date_key)
    return len(completed_cities) >= TOTAL_CITY_COUNT
