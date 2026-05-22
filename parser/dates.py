from datetime import datetime, timedelta, timezone

from config import TURKEY_UTC_OFFSET


def get_turkey_now() -> datetime:
    turkey_tz = timezone(timedelta(hours=TURKEY_UTC_OFFSET))
    return datetime.now(timezone.utc).astimezone(turkey_tz)


def format_scrape_date(moment: datetime) -> str:
    return moment.strftime("%d/%m/%Y")


def get_active_scrape_dates() -> list[str]:
    today = get_turkey_now()
    return [
        format_scrape_date(today),
        format_scrape_date(today + timedelta(days=1)),
    ]
