from __future__ import annotations

from typing import Any

from city_mapping import get_city_name
from config import TOTAL_CITY_COUNT
from dates import parse_scrape_date
from db import check_db_connection, get_session_factory
from models import CompletedCity, Pharmacy
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

PharmacyRecord = dict[str, Any]


def get_pool():
    return get_session_factory()


def to_pharmacy_models(
    duty_date,
    plate_code: str,
    pharmacies: list[PharmacyRecord],
) -> list[Pharmacy]:
    city_name = get_city_name(plate_code).title()
    return [
        Pharmacy(
            duty_date=duty_date,
            city=city_name,
            district=pharmacy.get("İlçe", ""),
            name=pharmacy.get("Ad", ""),
            phone=pharmacy.get("Telefon", ""),
            address=pharmacy.get("Adres", ""),
            lat=pharmacy.get("Lat"),
            long=pharmacy.get("Long"),
        )
        for pharmacy in pharmacies
    ]


def load_completed_cities(date_str: str) -> set[str]:
    duty_date = parse_scrape_date(date_str)

    try:
        with get_session_factory()() as session:
            plate_codes = session.scalars(
                select(CompletedCity.plate_code).where(
                    CompletedCity.duty_date == duty_date
                )
            ).all()
        return {str(plate_code) for plate_code in plate_codes}
    except Exception as error:
        print(f"✗ Database load error: {error}")
        return set()


def save_city_pharmacies(
    date_str: str, plate_code: str, pharmacies: list[PharmacyRecord]
) -> bool:
    duty_date = parse_scrape_date(date_str)
    city_name = get_city_name(plate_code).title()

    try:
        with get_session_factory()() as session:
            with session.begin():
                session.execute(
                    delete(Pharmacy).where(
                        Pharmacy.duty_date == duty_date,
                        Pharmacy.city == city_name,
                    )
                )

                if pharmacies:
                    session.add_all(
                        to_pharmacy_models(duty_date, plate_code, pharmacies)
                    )

                session.execute(
                    insert(CompletedCity)
                    .values(duty_date=duty_date, plate_code=int(plate_code))
                    .on_conflict_do_nothing(
                        index_elements=["duty_date", "plate_code"]
                    )
                )

        return True
    except Exception as error:
        print(f"✗ Database save error: {error}")
        return False


def is_scrape_complete(date_str: str) -> bool:
    return len(load_completed_cities(date_str)) >= TOTAL_CITY_COUNT


__all__ = [
    "PharmacyRecord",
    "check_db_connection",
    "get_pool",
    "is_scrape_complete",
    "load_completed_cities",
    "save_city_pharmacies",
]
