import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from common import (
    CITY_WORKERS,
    get_redis_client,
    get_scrape_dates,
    get_turkish_time,
    load_scrape_state,
    merge_city_pharmacies,
    redis_has_data,
    save_scrape_state,
)
from city_mapping import get_city_name
from parser import ScrapeSession


def scrape_city_job(date_str, plaka_str):
    session = ScrapeSession(date_str)
    if not session.start():
        return plaka_str, {"success": False, "tooktime": 0, "count": 0, "list": []}
    return plaka_str, session.scrape_city(plaka_str)


def format_result_line(plaka_kodu, city_name, result, redis_saved):
    coord_info = ""
    if result["count"] > 0:
        missing_coords = sum(
            1 for p in result["list"] if not p.get("Lat") or not p.get("Long")
        )
        if missing_coords > 0:
            coord_percentage = ((result["count"] - missing_coords) / result["count"]) * 100
            coord_info = f", {coord_percentage:.0f}% coords"

    redis_status = "✓" if redis_saved else "✗"
    return (
        f"✓ {result['count']} pharmacies ({result['tooktime']}s{coord_info}) "
        f"Redis:{redis_status}"
    )


def process_single_date(redis_client, date_str):
    successful = 0
    failed = 0
    skipped = 0

    probe = ScrapeSession(date_str)
    if not probe.start():
        available = ", ".join(probe.available_dates) or "none"
        print(f"✗ Date {date_str} is not available on site (options: {available})")
        return

    all_pharmacies, completed_cities = load_scrape_state(redis_client, date_str)
    pending = [str(i) for i in range(1, 82) if str(i) not in completed_cities]
    skipped = 81 - len(pending)

    print(f"Starting pharmacy data collection for {date_str}")
    print(f"Redis connection: {'✓ Connected' if redis_client else '✗ Not connected'}")
    print(f"Workers: {CITY_WORKERS}")
    if skipped:
        print(f"Resuming scrape: {skipped}/81 cities already completed")
    print("=" * 60)

    state_lock = threading.Lock()

    with ThreadPoolExecutor(max_workers=CITY_WORKERS) as pool:
        futures = {
            pool.submit(scrape_city_job, date_str, plaka_str): plaka_str
            for plaka_str in pending
        }

        for future in as_completed(futures):
            plaka_str = futures[future]
            plaka_kodu = int(plaka_str)
            city_name = get_city_name(plaka_str)

            try:
                plaka_str, result = future.result()
            except Exception as e:
                print(f"Processing {plaka_kodu:2d}/81: {city_name} ({plaka_str}) ... ✗ Error: {e}")
                failed += 1
                continue

            print(f"Processing {plaka_kodu:2d}/81: {city_name} ({plaka_str})", end=" ... ")

            if result["success"]:
                with state_lock:
                    all_pharmacies = merge_city_pharmacies(
                        all_pharmacies, plaka_str, result["list"]
                    )
                    completed_cities.add(plaka_str)
                    redis_saved = save_scrape_state(
                        redis_client, date_str, all_pharmacies, completed_cities
                    )

                print(format_result_line(plaka_kodu, city_name, result, redis_saved))
                successful += 1
            else:
                print(f"✗ Failed ({result['tooktime']}s)")
                failed += 1

    print(
        f"\n📊 FINAL RESULTS: ✓ {successful} successful, ↷ {skipped} skipped, ✗ {failed} failed"
    )


def process_multiple_dates():
    redis_client = get_redis_client()
    scrape_dates = get_scrape_dates()

    for date_str in scrape_dates:
        print(f"\nChecking date: {date_str}")

        if redis_has_data(redis_client, date_str):
            print(f"✓ Data already exists for {date_str} - SKIPPING")
            continue

        print(f"✗ No complete data for {date_str} - PROCESSING")

        try:
            process_single_date(redis_client, date_str)
            print(f"✓ Completed processing for {date_str}")
        except KeyboardInterrupt:
            print(f"\n\nProcess interrupted by user while processing {date_str}")
            break
        except Exception as e:
            print(f"\nError processing {date_str}: {e}")
            continue

        print("-" * 60)


def run_scheduler():
    while True:
        try:
            current_time = get_turkish_time()
            print(
                f"\n🕐 Starting collection at: {current_time.strftime('%d/%m/%Y %H:%M:%S')} (UTC+3)"
            )

            process_multiple_dates()
            time.sleep(43200)

        except KeyboardInterrupt:
            print("\n\n🛑 Scheduler stopped by user.")
            break
        except Exception as e:
            print(f"\n❌ Error in scheduler: {e}")
            print("⏰ Retrying in 10 minutes...")
            time.sleep(600)


def main():
    try:
        run_scheduler()
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user.")
    except Exception as e:
        print(f"\nUnexpected error: {e}")


if __name__ == "__main__":
    main()
