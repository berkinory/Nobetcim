from __future__ import annotations

import datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Mirrors db/migrations; the SQL files are the source of truth.


class Base(DeclarativeBase):
    pass


class City(Base):
    __tablename__ = "city"

    plate_code: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    name: Mapped[str] = mapped_column(Text)


class Pharmacy(Base):
    __tablename__ = "pharmacy"
    __table_args__ = (
        UniqueConstraint("plate_code", "district", "name", "address", name="pharmacy_identity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plate_code: Mapped[int] = mapped_column(SmallInteger, ForeignKey("city.plate_code"))
    district: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    address: Mapped[str] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(Text, default="")
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Duty(Base):
    __tablename__ = "duty"

    duty_date: Mapped[datetime.date] = mapped_column(Date, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey("pharmacy.id"), primary_key=True)
    starts_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))


class CityScrape(Base):
    __tablename__ = "city_scrape"

    duty_date: Mapped[datetime.date] = mapped_column(Date, primary_key=True)
    plate_code: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("city.plate_code"), primary_key=True
    )
    status: Mapped[str] = mapped_column(Text)
    pharmacy_count: Mapped[int] = mapped_column(Integer, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    scraped_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
