/** Tiny in-memory cache so bursts of map loads don't each hit Postgres. */
export class TtlCache<T> {
    readonly #entries = new Map<string, { value: T; expiresAt: number }>();

    constructor(
        private readonly ttlMs: number,
        private readonly maxEntries = 64
    ) {}

    async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
        const hit = this.#entries.get(key);
        if (hit && hit.expiresAt > Date.now()) return hit.value;

        const value = await load();
        if (this.#entries.size >= this.maxEntries) {
            const oldest = this.#entries.keys().next().value;
            if (oldest !== undefined) this.#entries.delete(oldest);
        }
        this.#entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
    }
}
