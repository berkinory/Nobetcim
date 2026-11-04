from datetime import date, datetime, timedelta, timezone

from config import TURKEY_UTC_OFFSET_HOURS

TURKEY_TZ = timezone(timedelta(hours=TURKEY_UTC_OFFSET_HOURS))
SITE_DATE_FORMAT = "%d/%m/%Y"


def turkey_now() -> datetime:
    return datetime.now(TURKEY_TZ)


def format_site_date(value: date) -> str:
    return value.strftime(SITE_DATE_FORMAT)


def parse_site_date(value: str) -> date:
    return datetime.strptime(value, SITE_DATE_FORMAT).date()
