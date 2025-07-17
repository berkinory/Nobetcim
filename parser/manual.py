#!/usr/bin/env python3

import json
from datetime import datetime, timedelta, timezone
from parser import parser
from city_mapping import get_city_name
from upstash_redis import Redis
import os
from dotenv import load_dotenv

load_dotenv()

CITY_CODE = ""

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

def save_to_redis(redis_client, date_key, plaka_kodu, pharmacies):
    try:
        if not redis_client:
            return False

        city_name = get_city_name(plaka_kodu).title()
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
                date_key, json.dumps(existing_list, ensure_ascii=False), ex=604800
            )
        else:
            redis_client.set(
                date_key, json.dumps(redis_data, ensure_ascii=False), ex=604800
            )

        return True
    except Exception as e:
        print(f"✗ Redis save error: {e}")
        return False

def manual_scrape():
    print("🏥 Manual Pharmacy Data Collection")
    print("=" * 50)
    
    redis_client = get_redis_client()
    print(f"Redis connection: {'✓ Connected' if redis_client else '✗ Not connected'}")
    
    current_time = get_turkish_time()
    date_str = format_date(current_time)
    
    print(f"Date: {date_str}")
    print(f"Time: {current_time.strftime('%H:%M:%S')} (UTC+3)")
    print("-" * 50)
    
    plaka_kodu = CITY_CODE
    city_name = get_city_name(plaka_kodu)
    
    print(f"Processing: {city_name} (code: {plaka_kodu})")
    print("Fetching pharmacy data...", end=" ")
    
    try:
        result = parser(plaka_kodu, date_str)
        
        if result["success"] and result["list"]:
            print(f"✓ Found {result['count']} pharmacies ({result['tooktime']}s)")
            
            # Save to Redis (Upstash)
            print("Saving to Upstash Redis...", end=" ")
            redis_saved = save_to_redis(redis_client, date_str, plaka_kodu, result["list"])
            
            if redis_saved:
                print("✓ Successfully saved to Upstash")
                print("\nSummary:")
                print(f"- City: {city_name}")
                print(f"- Date: {date_str}")
                print(f"- Pharmacies: {result['count']}")
                print(f"- Processing time: {result['tooktime']}s")
                print(f"- Redis key: {date_str}")
                print("- Data expires in: 7 days")
            else:
                print("✗ Failed to save to Upstash")
                return False
        else:
            print("✗ Failed to fetch pharmacy data")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    return True

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