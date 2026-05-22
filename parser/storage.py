from __future__ import annotations

from typing import Any

from city_mapping import get_city_name
from config import CITY_WORKER_COUNT, DATABASE_URL, TOTAL_CITY_COUNT
from dates import parse_scrape_date
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

PharmacyRecord = dict[str, Any]

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool

    if _pool is None:
        _pool = ConnectionPool(
            DATABASE_URL,
            min_size=1,
            max_size=max(CITY_WORKER_COUNT + 2, 4),
            kwargs={"row_factory": dict_row},
        )

    return _pool


def to_storage_records(plate_code: str, pharmacies: list[PharmacyRecord]) -> list[tuple[Any, ...]]:
    city_name = get_city_name(plate_code).title()
    return [
        (
            city_name,
            pharmacy.get("İlçe", ""),
            pharmacy.get("Ad", ""),
            pharmacy.get("Telefon", ""),
            pharmacy.get("Adres", ""),
            pharmacy.get("Lat"),
            pharmacy.get("Long"),
        )
        for pharmacy in pharmacies
    ]


def load_completed_cities(date_str: str) -> set[str]:
    duty_date = parse_scrape_date(date_str)

    try:
        with get_pool().connection() as connection:
            rows = connection.execute(
                """
                SELECT plate_code::text AS plate_code
                FROM completed_cities
                WHERE duty_date = %s
                """,
                (duty_date,),
            ).fetchall()
        return {row["plate_code"] for row in rows}
    except Exception as error:
        print(f"✗ Database load error: {error}")
        return set()


def save_city_pharmacies(date_str: str, plate_code: str, pharmacies: list[PharmacyRecord]) -> bool:
    duty_date = parse_scrape_date(date_str)
    city_name = get_city_name(plate_code).title()
    records = to_storage_records(plate_code, pharmacies)

    try:
        with get_pool().connection() as connection:
            with connection.transaction():
                connection.execute(
                    """
                    DELETE FROM pharmacies
                    WHERE duty_date = %s AND city = %s
                    """,
                    (duty_date, city_name),
                )

                if records:
                    connection.executemany(
                        """
                        INSERT INTO pharmacies (
                            duty_date,
                            city,
                            district,
                            name,
                            phone,
                            address,
                            lat,
                            long
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [(duty_date, *record) for record in records],
                    )

                connection.execute(
                    """
                    INSERT INTO completed_cities (duty_date, plate_code)
                    VALUES (%s, %s)
                    ON CONFLICT (duty_date, plate_code) DO NOTHING
                    """,
                    (duty_date, int(plate_code)),
                )

        return True
    except Exception as error:
        print(f"✗ Database save error: {error}")
        return False


def is_scrape_complete(date_str: str) -> bool:
    return len(load_completed_cities(date_str)) >= TOTAL_CITY_COUNT
