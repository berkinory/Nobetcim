-- Normalized history schema. Every scrape appends to `duty`, so past on-duty
-- pharmacies stay queryable; `pharmacy` holds one row per physical pharmacy
-- and caches its coordinates so the scraper only geocodes new ones.

CREATE TABLE IF NOT EXISTS city (
    plate_code SMALLINT PRIMARY KEY,
    name TEXT NOT NULL
);

INSERT INTO city (plate_code, name) VALUES
    (1, 'Adana'),
    (2, 'Adıyaman'),
    (3, 'Afyonkarahisar'),
    (4, 'Ağrı'),
    (5, 'Amasya'),
    (6, 'Ankara'),
    (7, 'Antalya'),
    (8, 'Artvin'),
    (9, 'Aydın'),
    (10, 'Balıkesir'),
    (11, 'Bilecik'),
    (12, 'Bingöl'),
    (13, 'Bitlis'),
    (14, 'Bolu'),
    (15, 'Burdur'),
    (16, 'Bursa'),
    (17, 'Çanakkale'),
    (18, 'Çankırı'),
    (19, 'Çorum'),
    (20, 'Denizli'),
    (21, 'Diyarbakır'),
    (22, 'Edirne'),
    (23, 'Elazığ'),
    (24, 'Erzincan'),
    (25, 'Erzurum'),
    (26, 'Eskişehir'),
    (27, 'Gaziantep'),
    (28, 'Giresun'),
    (29, 'Gümüşhane'),
    (30, 'Hakkari'),
    (31, 'Hatay'),
    (32, 'Isparta'),
    (33, 'Mersin'),
    (34, 'İstanbul'),
    (35, 'İzmir'),
    (36, 'Kars'),
    (37, 'Kastamonu'),
    (38, 'Kayseri'),
    (39, 'Kırklareli'),
    (40, 'Kırşehir'),
    (41, 'Kocaeli'),
    (42, 'Konya'),
    (43, 'Kütahya'),
    (44, 'Malatya'),
    (45, 'Manisa'),
    (46, 'Kahramanmaraş'),
    (47, 'Mardin'),
    (48, 'Muğla'),
    (49, 'Muş'),
    (50, 'Nevşehir'),
    (51, 'Niğde'),
    (52, 'Ordu'),
    (53, 'Rize'),
    (54, 'Sakarya'),
    (55, 'Samsun'),
    (56, 'Siirt'),
    (57, 'Sinop'),
    (58, 'Sivas'),
    (59, 'Tekirdağ'),
    (60, 'Tokat'),
    (61, 'Trabzon'),
    (62, 'Tunceli'),
    (63, 'Şanlıurfa'),
    (64, 'Uşak'),
    (65, 'Van'),
    (66, 'Yozgat'),
    (67, 'Zonguldak'),
    (68, 'Aksaray'),
    (69, 'Bayburt'),
    (70, 'Karaman'),
    (71, 'Kırıkkale'),
    (72, 'Batman'),
    (73, 'Şırnak'),
    (74, 'Bartın'),
    (75, 'Ardahan'),
    (76, 'Iğdır'),
    (77, 'Yalova'),
    (78, 'Karabük'),
    (79, 'Kilis'),
    (80, 'Osmaniye'),
    (81, 'Düzce')
ON CONFLICT (plate_code) DO UPDATE SET name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS pharmacy (
    id SERIAL PRIMARY KEY,
    plate_code SMALLINT NOT NULL REFERENCES city (plate_code),
    district TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pharmacy_identity UNIQUE (plate_code, district, name, address)
);

CREATE TABLE IF NOT EXISTS duty (
    duty_date DATE NOT NULL,
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacy (id) ON DELETE CASCADE,
    -- Shift window as published; NULL for rows backfilled from legacy data.
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    PRIMARY KEY (duty_date, pharmacy_id)
);

CREATE INDEX IF NOT EXISTS duty_pharmacy_idx ON duty (pharmacy_id, duty_date);

-- Latest scrape outcome per city and date. 'empty' and 'failed' are retried;
-- 'ok' is refreshed periodically because chambers amend lists during the day.
CREATE TABLE IF NOT EXISTS city_scrape (
    duty_date DATE NOT NULL,
    plate_code SMALLINT NOT NULL REFERENCES city (plate_code),
    status TEXT NOT NULL CHECK (status IN ('ok', 'empty', 'failed')),
    pharmacy_count INTEGER NOT NULL DEFAULT 0,
    -- Consecutive unsuccessful attempts; reset to 0 by a successful scrape.
    attempts INTEGER NOT NULL DEFAULT 0,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (duty_date, plate_code)
);

-- Backfill from the legacy tables. Their city column holds Python's
-- str.title() output, which mangles Turkish dotted/dotless i.
CREATE TEMP TABLE legacy_city (legacy_name TEXT PRIMARY KEY, plate_code SMALLINT NOT NULL) ON COMMIT DROP;

INSERT INTO legacy_city (legacy_name, plate_code) VALUES
    ('Adana', 1),
    ('Adiyaman', 2),
    ('Afyonkarahi̇sar', 3),
    ('Ağri', 4),
    ('Amasya', 5),
    ('Ankara', 6),
    ('Antalya', 7),
    ('Artvi̇n', 8),
    ('Aydin', 9),
    ('Balikesi̇r', 10),
    ('Bi̇leci̇k', 11),
    ('Bi̇ngöl', 12),
    ('Bi̇tli̇s', 13),
    ('Bolu', 14),
    ('Burdur', 15),
    ('Bursa', 16),
    ('Çanakkale', 17),
    ('Çankiri', 18),
    ('Çorum', 19),
    ('Deni̇zli̇', 20),
    ('Di̇yarbakir', 21),
    ('Edi̇rne', 22),
    ('Elaziğ', 23),
    ('Erzi̇ncan', 24),
    ('Erzurum', 25),
    ('Eski̇şehi̇r', 26),
    ('Gazi̇antep', 27),
    ('Gi̇resun', 28),
    ('Gümüşhane', 29),
    ('Hakkari̇', 30),
    ('Hatay', 31),
    ('Isparta', 32),
    ('Mersi̇n', 33),
    ('İstanbul', 34),
    ('İzmi̇r', 35),
    ('Kars', 36),
    ('Kastamonu', 37),
    ('Kayseri̇', 38),
    ('Kirklareli̇', 39),
    ('Kirşehi̇r', 40),
    ('Kocaeli̇', 41),
    ('Konya', 42),
    ('Kütahya', 43),
    ('Malatya', 44),
    ('Mani̇sa', 45),
    ('Kahramanmaraş', 46),
    ('Mardi̇n', 47),
    ('Muğla', 48),
    ('Muş', 49),
    ('Nevşehi̇r', 50),
    ('Ni̇ğde', 51),
    ('Ordu', 52),
    ('Ri̇ze', 53),
    ('Sakarya', 54),
    ('Samsun', 55),
    ('Si̇i̇rt', 56),
    ('Si̇nop', 57),
    ('Si̇vas', 58),
    ('Teki̇rdağ', 59),
    ('Tokat', 60),
    ('Trabzon', 61),
    ('Tunceli̇', 62),
    ('Şanliurfa', 63),
    ('Uşak', 64),
    ('Van', 65),
    ('Yozgat', 66),
    ('Zonguldak', 67),
    ('Aksaray', 68),
    ('Bayburt', 69),
    ('Karaman', 70),
    ('Kirikkale', 71),
    ('Batman', 72),
    ('Şirnak', 73),
    ('Bartin', 74),
    ('Ardahan', 75),
    ('Iğdir', 76),
    ('Yalova', 77),
    ('Karabük', 78),
    ('Ki̇li̇s', 79),
    ('Osmani̇ye', 80),
    ('Düzce', 81);

CREATE TEMP TABLE legacy_row ON COMMIT DROP AS
SELECT
    p.duty_date,
    lc.plate_code,
    regexp_replace(btrim(p.district), '\s+', ' ', 'g') AS district,
    regexp_replace(btrim(p.name), '\s+', ' ', 'g') AS name,
    regexp_replace(btrim(p.address), '\s+', ' ', 'g') AS address,
    p.phone,
    p.lat,
    p.long AS lng
FROM pharmacies p
JOIN legacy_city lc ON lc.legacy_name = p.city;

INSERT INTO pharmacy (plate_code, district, name, address, phone, lat, lng)
SELECT DISTINCT ON (plate_code, district, name, address)
    plate_code, district, name, address, phone, lat, lng
FROM legacy_row
ORDER BY plate_code, district, name, address, (lat IS NULL), duty_date DESC
ON CONFLICT ON CONSTRAINT pharmacy_identity DO NOTHING;

INSERT INTO duty (duty_date, pharmacy_id)
SELECT DISTINCT r.duty_date, ph.id
FROM legacy_row r
JOIN pharmacy ph USING (plate_code, district, name, address)
ON CONFLICT DO NOTHING;

INSERT INTO city_scrape (duty_date, plate_code, status, pharmacy_count, scraped_at)
SELECT
    cc.duty_date,
    cc.plate_code,
    CASE WHEN COUNT(d.pharmacy_id) > 0 THEN 'ok' ELSE 'empty' END,
    COUNT(d.pharmacy_id),
    cc.completed_at
FROM completed_cities cc
LEFT JOIN pharmacy ph ON ph.plate_code = cc.plate_code
LEFT JOIN duty d ON d.pharmacy_id = ph.id AND d.duty_date = cc.duty_date
GROUP BY cc.duty_date, cc.plate_code, cc.completed_at
ON CONFLICT DO NOTHING;
