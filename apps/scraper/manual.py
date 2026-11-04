"""Scrape a single city on demand: `python manual.py 34 [DD/MM/YYYY]`."""

from __future__ import annotations

import argparse
import logging

from config import MAX_PLATE_CODE, MIN_PLATE_CODE
from dates import format_site_date, parse_site_date, turkey_now
from jobs import scrape_city


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plate_code", type=int, choices=range(MIN_PLATE_CODE, MAX_PLATE_CODE + 1))
    parser.add_argument("date", nargs="?", default=format_site_date(turkey_now()))
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    result = scrape_city(parse_site_date(args.date), args.plate_code)
    print(result)
    raise SystemExit(0 if result.status == "ok" else 1)


if __name__ == "__main__":
    main()
