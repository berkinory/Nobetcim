import {
    date,
    doublePrecision,
    pgTable,
    primaryKey,
    serial,
    smallint,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';

export const pharmacies = pgTable('pharmacies', {
    id: serial('id').primaryKey(),
    dutyDate: date('duty_date').notNull(),
    city: text('city').notNull(),
    district: text('district').notNull().default(''),
    name: text('name').notNull(),
    phone: text('phone').notNull().default(''),
    address: text('address').notNull().default(''),
    lat: doublePrecision('lat'),
    long: doublePrecision('long'),
});

export const completedCities = pgTable(
    'completed_cities',
    {
        dutyDate: date('duty_date').notNull(),
        plateCode: smallint('plate_code').notNull(),
        completedAt: timestamp('completed_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [primaryKey({ columns: [table.dutyDate, table.plateCode] })]
);

export type Pharmacy = typeof pharmacies.$inferSelect;
