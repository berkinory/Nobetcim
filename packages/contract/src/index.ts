/** A pharmacy on duty for a given date, as served by `GET /api/duties`. */
export interface DutyPharmacy {
    id: number;
    name: string;
    district: string;
    city: string;
    address: string;
    phone: string;
    /** Null when the upstream source had no coordinates for this pharmacy. */
    lat: number | null;
    lng: number | null;
    /** Published shift window (ISO 8601); null for older backfilled days. */
    startsAt: string | null;
    endsAt: string | null;
}

export interface DutiesResponse {
    /**
     * Duty date in `YYYY-MM-DD`. The active list (no `date` query) can also
     * hold last night's shifts that are still running.
     */
    date: string;
    pharmacies: DutyPharmacy[];
    /** Cities with no published duty list for this date. */
    missingCities: string[];
    /** When the server built this response; tells offline users its age. */
    generatedAt: string;
}

export interface DutyDateSummary {
    date: string;
    pharmacyCount: number;
}

export interface ApiError {
    error: string;
}
