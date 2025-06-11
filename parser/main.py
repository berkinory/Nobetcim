import json
import time
from datetime import datetime, timedelta, timezone
from parser import parser
from city_mapping import get_city_name
from upstash_redis import Redis
import os
from dotenv import load_dotenv

load_dotenv()


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
    utc_now = datetime.now(timezone.utc)
    return utc_now.astimezone(turkish_tz)


def format_date(date_obj):
    return date_obj.strftime("%d/%m/%Y")


def redis_has_data(redis_client, date_key):
    try:
        if not redis_client:
            return False
        existing_data = redis_client.get(date_key)
        if existing_data:
            data = json.loads(existing_data)
            return len(data) > 0
        return False
    except Exception as e:
        print(f"✗ Redis save error: {e}")
        return False


def save_to_redis(redis_client, date_key, plaka_kodu, pharmacies):
    try:
        if not redis_client:
            return False

        city_name = get_city_name(plaka_kodu)
        redis_data = []

        for pharmacy in pharmacies:
            redis_data.append(
                {
                    "city": city_name,
                    "district": pharmacy.get("İlçe", ""),
                    "name": pharmacy.get("Ad", ""),
                    "phone": pharmacy.get("Telefon", ""),
                    "address": pharmacy.get("Adres", ""),
                    "lat": pharmacy.get("Lat"),
                    "long": pharmacy.get("Long"),
                }
            )

        existing_data = redis_client.get(date_key)
        if existing_data:
            existing_list = json.loads(existing_data)
            existing_list.extend(redis_data)
            redis_client.set(
                date_key, json.dumps(existing_list, ensure_ascii=False), ex=345600
            )
        else:
            redis_client.set(
                date_key, json.dumps(redis_data, ensure_ascii=False), ex=345600
            )

        return True
    except Exception:
        return False


def process_single_date(redis_client, date_str):
    successful = 0
    failed = 0

    print(f"Starting pharmacy data collection for {date_str}")
    print(f"Redis connection: {'✓ Connected' if redis_client else '✗ Not connected'}")
    print("=" * 60)

    for plaka_kodu in range(1, 82):
        plaka_str = str(plaka_kodu)
        city_name = get_city_name(plaka_str)

        print(f"Processing {plaka_kodu:2d}/81: {city_name} ({plaka_str})", end=" ... ")

        try:
            result = parser(plaka_str, date_str)

            if result["success"] and result["list"]:
                redis_saved = save_to_redis(
                    redis_client, date_str, plaka_str, result["list"]
                )
                redis_status = "✓" if redis_saved else "✗"
                print(
                    f"✓ {result['count']} pharmacies ({result['tooktime']}s) Redis:{redis_status}"
                )
                successful += 1
            else:
                print("✗ Failed")
                failed += 1

        except Exception as e:
            print(f"✗ Error: {e}")
            failed += 1

        time.sleep(2)


def process_multiple_dates(days=3):
    redis_client = get_redis_client()
    current_date = get_turkish_time()

    for day_offset in range(days):
        target_date = current_date + timedelta(days=day_offset)
        date_str = format_date(target_date)

        print(f"\nChecking date: {date_str}")

        if redis_has_data(redis_client, date_str):
            print(f"✓ Data already exists for {date_str} - SKIPPING")
            continue

        print(f"✗ No data found for {date_str} - PROCESSING")

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
    print("🚀 Pharmacy Data Collector - 6 Hour Scheduler Started")
    print(f"⏰ Next run times will be every 6 hours")
    print("=" * 60)

    while True:
        try:
            current_time = get_turkish_time()
            print(
                f"\n🕐 Starting collection at: {current_time.strftime('%d/%m/%Y %H:%M:%S')} (UTC+3)"
            )

            process_multiple_dates(3)

            print(f"\n✅ Collection completed. Sleeping for 6 hours...")
            print(
                f"⏰ Next run at: {(current_time + timedelta(hours=6)).strftime('%d/%m/%Y %H:%M:%S')} (UTC+3)"
            )
            print("=" * 60)

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
