from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from city_mapping import get_city_name
from config import (
    CITY_WORKER_COUNT,
    MAX_PLATE_CODE,
    MIN_PLATE_CODE,
    SCHEDULER_ERROR_RETRY_SECONDS,
    SCHEDULER_INTERVAL_SECONDS,
    TOTAL_CITY_COUNT,
)
from dates import get_active_scrape_dates, get_turkey_now
from scraper import ScrapeResult, ScrapeSession
from storage import (
    get_redis_client,
    is_scrape_complete,
    load_scrape_state,
    merge_city_records,
    save_scrape_state,
)


def scrape_city_job(date_str: str, plate_code: str) -> tuple[str, ScrapeResult]:
    session = ScrapeSession(date_str)
    if not session.start():
        return plate_code, {"success": False, "tooktime": 0, "count": 0, "list": []}
    return plate_code, session.scrape_city(plate_code)


def format_success_line(result: ScrapeResult, redis_saved: bool) -> str:
    coord_suffix = ""
    if result["count"] > 0:
        missing_coords = sum(1 for pharmacy in result["list"] if not pharmacy.get("Lat") or not pharmacy.get("Long"))
        if missing_coords:
            completion_rate = ((result["count"] - missing_coords) / result["count"]) * 100
            coord_suffix = f", {completion_rate:.0f}% coords"

    redis_status = "✓" if redis_saved else "✗"
    return f"✓ {result['count']} pharmacies ({result['tooktime']}s{coord_suffix}) Redis:{redis_status}"


def pending_plate_codes(completed_cities: set[str]) -> list[str]:
    return [
        str(plate_code)
        for plate_code in range(MIN_PLATE_CODE, MAX_PLATE_CODE + 1)
        if str(plate_code) not in completed_cities
    ]


def process_single_date(redis_client, date_str: str) -> None:
    probe = ScrapeSession(date_str)
    if not probe.start():
        available = ", ".join(probe.available_dates) or "none"
        print(f"✗ Date {date_str} is not available on site (options: {available})")
        return

    all_pharmacies, completed_cities = load_scrape_state(redis_client, date_str)
    pending = pending_plate_codes(completed_cities)
    skipped_count = TOTAL_CITY_COUNT - len(pending)

    print(f"Starting pharmacy data collection for {date_str}")
    print(f"Redis connection: {'✓ Connected' if redis_client else '✗ Not connected'}")
    print(f"Workers: {CITY_WORKER_COUNT}")
    if skipped_count:
        print(f"Resuming scrape: {skipped_count}/{TOTAL_CITY_COUNT} cities already completed")
    print("=" * 60)

    successful = 0
    failed = 0
    state_lock = threading.Lock()

    with ThreadPoolExecutor(max_workers=CITY_WORKER_COUNT) as executor:
        futures = {
            executor.submit(scrape_city_job, date_str, plate_code): plate_code
            for plate_code in pending
        }

        for future in as_completed(futures):
            plate_code = futures[future]
            plate_number = int(plate_code)
            city_name = get_city_name(plate_code)

            try:
                plate_code, result = future.result()
            except Exception as error:
                print(
                    f"Processing {plate_number:2d}/{TOTAL_CITY_COUNT}: "
                    f"{city_name} ({plate_code}) ... ✗ Error: {error}"
                )
                failed += 1
                continue

            print(
                f"Processing {plate_number:2d}/{TOTAL_CITY_COUNT}: "
                f"{city_name} ({plate_code})",
                end=" ... ",
            )

            if result["success"]:
                with state_lock:
                    all_pharmacies = merge_city_records(all_pharmacies, plate_code, result["list"])
                    completed_cities.add(plate_code)
                    redis_saved = save_scrape_state(
                        redis_client,
                        date_str,
                        all_pharmacies,
                        completed_cities,
                    )

                print(format_success_line(result, redis_saved))
                successful += 1
            else:
                print(f"✗ Failed ({result['tooktime']}s)")
                failed += 1

    print(
        f"\n📊 FINAL RESULTS: ✓ {successful} successful, "
        f"↷ {skipped_count} skipped, ✗ {failed} failed"
    )


def process_active_dates() -> None:
    redis_client = get_redis_client()

    for date_str in get_active_scrape_dates():
        print(f"\nChecking date: {date_str}")

        if is_scrape_complete(redis_client, date_str):
            print(f"✓ Data already exists for {date_str} - SKIPPING")
            continue

        print(f"✗ No complete data for {date_str} - PROCESSING")

        try:
            process_single_date(redis_client, date_str)
            print(f"✓ Completed processing for {date_str}")
        except KeyboardInterrupt:
            print(f"\n\nProcess interrupted by user while processing {date_str}")
            break
        except Exception as error:
            print(f"\nError processing {date_str}: {error}")
            continue

        print("-" * 60)


def run_scheduler() -> None:
    while True:
        try:
            now = get_turkey_now()
            print(f"\n🕐 Starting collection at: {now.strftime('%d/%m/%Y %H:%M:%S')} (UTC+3)")
            process_active_dates()
            time.sleep(SCHEDULER_INTERVAL_SECONDS)
        except KeyboardInterrupt:
            print("\n\n🛑 Scheduler stopped by user.")
            break
        except Exception as error:
            print(f"\n❌ Error in scheduler: {error}")
            print("⏰ Retrying in 10 minutes...")
            time.sleep(SCHEDULER_ERROR_RETRY_SECONDS)


def main() -> None:
    try:
        run_scheduler()
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user.")
    except Exception as error:
        print(f"\nUnexpected error: {error}")


if __name__ == "__main__":
    main()
