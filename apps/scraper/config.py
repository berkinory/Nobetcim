import os

MIN_PLATE_CODE = 1
MAX_PLATE_CODE = 81
PLATE_CODES = tuple(range(MIN_PLATE_CODE, MAX_PLATE_CODE + 1))

CITY_WORKER_COUNT = int(os.environ.get("CITY_WORKER_COUNT", "3"))
MAX_RETRIES = 4
RETRY_BACKOFF_SECONDS = 1.5
REQUEST_TIMEOUT_SECONDS = 15
COORD_MAX_RETRIES = 3

# How often the scheduler wakes up to look for due cities.
SCHEDULER_INTERVAL_SECONDS = int(os.environ.get("SCHEDULER_INTERVAL_SECONDS", "1800"))
SCHEDULER_ERROR_RETRY_SECONDS = 300
# Lists that scraped fine are re-checked because chambers amend them.
REFRESH_OK_AFTER_SECONDS = 6 * 3600
# Empty or failed cities back off linearly with each attempt, up to this cap.
RETRY_BASE_SECONDS = 1800
RETRY_MAX_SECONDS = 3 * 3600

TITCK_BASE_URL = "https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama"
TITCK_SUBMIT_URL = f"{TITCK_BASE_URL}?submit"
TITCK_RESULTS_URL = f"{TITCK_BASE_URL}?nobetci=Eczaneler"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    "Referer": TITCK_BASE_URL,
}

TURKEY_UTC_OFFSET_HOURS = 3

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://nobetcim:nobetcim@postgres:5432/nobetcim"
)
