import {
    date,
    doublePrecision,
    integer,
    pgTable,
    primaryKey,
    serial,
    smallint,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';

// Mirrors db/migrations; the SQL files are the source of truth.

export const city = pgTable('city', {
    plateCode: smallint('plate_code').primaryKey(),
    name: text('name').notNull(),
});

export const pharmacy = pgTable('pharmacy', {
    id: serial('id').primaryKey(),
    plateCode: smallint('plate_code')
        .notNull()
        .references(() => city.plateCode),
    district: text('district').notNull(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    phone: text('phone').notNull().default(''),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const duty = pgTable(
    'duty',
    {
        dutyDate: date('duty_date', { mode: 'string' }).notNull(),
        pharmacyId: integer('pharmacy_id')
            .notNull()
            .references(() => pharmacy.id),
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
    },
    (table) => [primaryKey({ columns: [table.dutyDate, table.pharmacyId] })]
);

export const cityScrape = pgTable(
    'city_scrape',
    {
        dutyDate: date('duty_date', { mode: 'string' }).notNull(),
        plateCode: smallint('plate_code')
            .notNull()
            .references(() => city.plateCode),
        status: text('status', { enum: ['ok', 'empty', 'failed'] }).notNull(),
        pharmacyCount: integer('pharmacy_count').notNull(),
        attempts: integer('attempts').notNull(),
        scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull(),
    },
    (table) => [primaryKey({ columns: [table.dutyDate, table.plateCode] })]
);
