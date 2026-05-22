#!/usr/bin/env python3

from common import (
    format_date,
    get_redis_client,
    get_turkish_time,
    load_scrape_state,
    merge_city_pharmacies,
    save_scrape_state,
)
from city_mapping import get_city_name
from parser import ScrapeSession

CITY_CODE = ""


def manual_scrape():
    print("🏥 Manual Pharmacy Data Collection")
    print("=" * 50)

    if not CITY_CODE or not CITY_CODE.isdigit() or not (1 <= int(CITY_CODE) <= 81):
        print("✗ Set CITY_CODE to a valid plate code between 1 and 81")
        return False

    redis_client = get_redis_client()
    print(f"Redis connection: {'✓ Connected' if redis_client else '✗ Not connected'}")

    current_time = get_turkish_time()
    date_str = format_date(current_time)

    print(f"Date: {date_str}")
    print(f"Time: {current_time.strftime('%H:%M:%S')} (UTC+3)")
    print("-" * 50)

    plaka_kodu = CITY_CODE
    city_name = get_city_name(plaka_kodu)

    scrape_session = ScrapeSession(date_str)
    if not scrape_session.start():
        available = ", ".join(scrape_session.available_dates) or "none"
        print(f"✗ Date {date_str} is not available on site (options: {available})")
        return False

    print(f"Processing: {city_name} (code: {plaka_kodu})")
    print("Fetching pharmacy data...", end=" ")

    try:
        result = scrape_session.scrape_city(plaka_kodu)

        if not result["success"]:
            print("✗ Failed to fetch pharmacy data")
            return False

        print(f"✓ Found {result['count']} pharmacies ({result['tooktime']}s)")

        all_pharmacies, completed_cities = load_scrape_state(redis_client, date_str)
        all_pharmacies = merge_city_pharmacies(all_pharmacies, plaka_kodu, result["list"])
        completed_cities.add(plaka_kodu)

        print("Saving to Upstash Redis...", end=" ")
        redis_saved = save_scrape_state(
            redis_client, date_str, all_pharmacies, completed_cities
        )

        if redis_saved:
            print("✓ Successfully saved to Upstash")
            print("\nSummary:")
            print(f"- City: {city_name}")
            print(f"- Date: {date_str}")
            print(f"- Pharmacies: {result['count']}")
            print(f"- Processing time: {result['tooktime']}s")
            print(f"- Redis key: {date_str}")
            print("- Data expires in: 7 days")
            return True

        print("✗ Failed to save to Upstash")
        return False

    except Exception as e:
        print(f"✗ Error: {e}")
        return False


if __name__ == "__main__":
    try:
        success = manual_scrape()
        if success:
            print("\n🎉 Pharmacy data successfully collected and saved to Upstash!")
        else:
            print("\n❌ Failed to collect pharmacy data")
    except KeyboardInterrupt:
        print("\n\n🛑 Process interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
