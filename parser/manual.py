#!/usr/bin/env python3

from __future__ import annotations

from city_mapping import get_city_name
from config import MAX_PLATE_CODE, MIN_PLATE_CODE, REDIS_TTL_SECONDS
from dates import format_scrape_date, get_turkey_now
from scraper import ScrapeSession, is_valid_plate_code
from storage import get_redis_client, load_scrape_state, merge_city_records, save_scrape_state

CITY_CODE = ""


def manual_scrape() -> bool:
    print("🏥 Manual Pharmacy Data Collection")
    print("=" * 50)

    if not is_valid_plate_code(CITY_CODE):
        print(f"✗ Set CITY_CODE to a valid plate code between {MIN_PLATE_CODE} and {MAX_PLATE_CODE}")
        return False

    redis_client = get_redis_client()
    print(f"Redis connection: {'✓ Connected' if redis_client else '✗ Not connected'}")

    now = get_turkey_now()
    date_str = format_scrape_date(now)

    print(f"Date: {date_str}")
    print(f"Time: {now.strftime('%H:%M:%S')} (UTC+3)")
    print("-" * 50)

    city_name = get_city_name(CITY_CODE)
    session = ScrapeSession(date_str)

    if not session.start():
        available = ", ".join(session.available_dates) or "none"
        print(f"✗ Date {date_str} is not available on site (options: {available})")
        return False

    print(f"Processing: {city_name} (code: {CITY_CODE})")
    print("Fetching pharmacy data...", end=" ")

    try:
        result = session.scrape_city(CITY_CODE)
        if not result["success"]:
            print("✗ Failed to fetch pharmacy data")
            return False

        print(f"✓ Found {result['count']} pharmacies ({result['tooktime']}s)")

        all_pharmacies, completed_cities = load_scrape_state(redis_client, date_str)
        all_pharmacies = merge_city_records(all_pharmacies, CITY_CODE, result["list"])
        completed_cities.add(CITY_CODE)

        print("Saving to Upstash Redis...", end=" ")
        if not save_scrape_state(redis_client, date_str, all_pharmacies, completed_cities):
            print("✗ Failed to save to Upstash")
            return False

        print("✓ Successfully saved to Upstash")
        print("\nSummary:")
        print(f"- City: {city_name}")
        print(f"- Date: {date_str}")
        print(f"- Pharmacies: {result['count']}")
        print(f"- Processing time: {result['tooktime']}s")
        print(f"- Redis key: {date_str}")
        print(f"- Data expires in: {REDIS_TTL_SECONDS // 86_400} days")
        return True
    except Exception as error:
        print(f"✗ Error: {error}")
        return False


if __name__ == "__main__":
    try:
        if manual_scrape():
            print("\n🎉 Pharmacy data successfully collected and saved to Upstash!")
        else:
            print("\n❌ Failed to collect pharmacy data")
    except KeyboardInterrupt:
        print("\n\n🛑 Process interrupted by user")
    except Exception as error:
        print(f"\n❌ Unexpected error: {error}")
