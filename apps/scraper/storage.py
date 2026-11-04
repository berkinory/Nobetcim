from __future__ import annotations

import datetime
from dataclasses import dataclass

from sqlalchemy import case, delete, func, select, tuple_
from sqlalchemy.dialects.postgresql import insert

from db import session_factory
from models import City, CityScrape, Duty, Pharmacy
from titck import ScrapedPharmacy


@dataclass(frozen=True)
class CityState:
    status: str
    attempts: int
    scraped_at: datetime.datetime


def load_city_names() -> dict[int, str]:
    with session_factory()() as session:
        return dict(session.execute(select(City.plate_code, City.name)).tuples().all())


def load_city_states(duty_date: datetime.date) -> dict[int, CityState]:
    with session_factory()() as session:
        rows = session.execute(
            select(
                CityScrape.plate_code,
                CityScrape.status,
                CityScrape.attempts,
                CityScrape.scraped_at,
            ).where(CityScrape.duty_date == duty_date)
        ).tuples()
        return {plate: CityState(status, attempts, at) for plate, status, attempts, at in rows}


def apply_known_coordinates(plate_code: int, pharmacies: list[ScrapedPharmacy]) -> None:
    """Fills coordinates from pharmacies seen before, so only new ones need the
    slow per-row map lookup."""
    if not pharmacies:
        return
    identity = tuple_(Pharmacy.district, Pharmacy.name, Pharmacy.address)
    with session_factory()() as session:
        rows = session.execute(
            select(
                Pharmacy.district, Pharmacy.name, Pharmacy.address, Pharmacy.lat, Pharmacy.lng
            ).where(
                Pharmacy.plate_code == plate_code,
                Pharmacy.lat.is_not(None),
                Pharmacy.lng.is_not(None),
                identity.in_([p.identity for p in pharmacies]),
            )
        ).tuples()
        known = {
            (district, name, address): (lat, lng) for district, name, address, lat, lng in rows
        }

    for pharmacy in pharmacies:
        coordinates = known.get(pharmacy.identity)
        if coordinates:
            pharmacy.lat, pharmacy.lng = coordinates


def save_city_duties(
    duty_date: datetime.date, plate_code: int, pharmacies: list[ScrapedPharmacy]
) -> None:
    """Replaces the city's duty list for the date and records the scrape as ok."""
    with session_factory()() as session, session.begin():
        upsert = insert(Pharmacy).values(
            [
                {
                    "plate_code": plate_code,
                    "district": p.district,
                    "name": p.name,
                    "address": p.address,
                    "phone": p.phone,
                    "lat": p.lat,
                    "lng": p.lng,
                }
                for p in pharmacies
            ]
        )
        pharmacy_ids = session.scalars(
            upsert.on_conflict_do_update(
                constraint="pharmacy_identity",
                set_={
                    "phone": upsert.excluded.phone,
                    "lat": func.coalesce(upsert.excluded.lat, Pharmacy.lat),
                    "lng": func.coalesce(upsert.excluded.lng, Pharmacy.lng),
                    "updated_at": func.now(),
                },
            ).returning(Pharmacy.id),
            # RETURNING keeps VALUES order for a single multi-row upsert.
            execution_options={"sort_by_parameter_order": True},
        ).all()

        city_pharmacies = select(Pharmacy.id).where(Pharmacy.plate_code == plate_code)
        session.execute(
            delete(Duty).where(Duty.duty_date == duty_date, Duty.pharmacy_id.in_(city_pharmacies))
        )
        session.execute(
            insert(Duty)
            .values(
                [
                    {
                        "duty_date": duty_date,
                        "pharmacy_id": pharmacy_id,
                        "starts_at": p.starts_at,
                        "ends_at": p.ends_at,
                    }
                    for pharmacy_id, p in zip(pharmacy_ids, pharmacies, strict=True)
                ]
            )
            .on_conflict_do_nothing()
        )
        _record(session, duty_date, plate_code, "ok", len(pharmacies))


def record_unsuccessful(duty_date: datetime.date, plate_code: int, status: str) -> None:
    """Records an empty or failed scrape. A previously good list is kept and the
    city stays 'ok'; the attempt counter grows so retries back off."""
    with session_factory()() as session, session.begin():
        _record(session, duty_date, plate_code, status, 0)


def _record(session, duty_date: datetime.date, plate_code: int, status: str, count: int) -> None:
    succeeded = status == "ok"
    stmt = insert(CityScrape).values(
        duty_date=duty_date,
        plate_code=plate_code,
        status=status,
        pharmacy_count=count,
        attempts=0 if succeeded else 1,
    )
    keep_previous_list = (CityScrape.status == "ok") & (stmt.excluded.status != "ok")
    session.execute(
        stmt.on_conflict_do_update(
            index_elements=["duty_date", "plate_code"],
            set_={
                "status": case((keep_previous_list, CityScrape.status), else_=stmt.excluded.status),
                "pharmacy_count": case(
                    (keep_previous_list, CityScrape.pharmacy_count),
                    else_=stmt.excluded.pharmacy_count,
                ),
                "attempts": 0 if succeeded else CityScrape.attempts + 1,
                "scraped_at": func.now(),
            },
        )
    )
