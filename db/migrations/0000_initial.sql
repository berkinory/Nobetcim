CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    duty_date DATE NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    lat DOUBLE PRECISION,
    long DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS pharmacies_duty_date_idx ON pharmacies (duty_date);

CREATE TABLE IF NOT EXISTS completed_cities (
    duty_date DATE NOT NULL,
    plate_code SMALLINT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (duty_date, plate_code)
);
