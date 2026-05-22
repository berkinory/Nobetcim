from __future__ import annotations

import datetime

from sqlalchemy import Date, DateTime, Float, SmallInteger, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id: Mapped[int] = mapped_column(primary_key=True)
    duty_date: Mapped[datetime.date] = mapped_column(Date, index=True)
    city: Mapped[str] = mapped_column(Text)
    district: Mapped[str] = mapped_column(Text, default="")
    name: Mapped[str] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(Text, default="")
    address: Mapped[str] = mapped_column(Text, default="")
    lat: Mapped[float | None] = mapped_column(Float)
    long: Mapped[float | None] = mapped_column("long", Float)


class CompletedCity(Base):
    __tablename__ = "completed_cities"

    duty_date: Mapped[datetime.date] = mapped_column(Date, primary_key=True)
    plate_code: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    completed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
