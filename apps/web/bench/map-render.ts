/**
 * Map render benchmark: drives the same pan/zoom gesture script on an
 * emulated mid-range Android phone and records frame times.
 *
 *   bun bench/map-render.ts [--new URL] [--old URL] [--runs N] [--cpu N]
 *                           [--stress N]
 *
 * `--old` defaults to the live site, `--new` to a local `apps/api` serving the
 * production web build. `--stress N` replaces the new app's data with N
 * synthetic pharmacies to show how far the WebGL layer scales.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { chromium, type Browser, type Page } from 'playwright';

const { values: args } = parseArgs({
    options: {
        new: { type: 'string', default: 'http://localhost:3001/' },
        old: { type: 'string', default: 'https://nobetcim.app/' },
        runs: { type: 'string', default: '3' },
        cpu: { type: 'string', default: '4' },
        stress: { type: 'string', default: '0' },
        only: { type: 'string' },
    },
});

// Kadıköy: one of the densest duty areas, so the old app's 100-marker cap
// is fully used.
const LOCATION = { latitude: 40.9903, longitude: 29.0277 };
const RESULTS_DIR = new URL('./results/', import.meta.url);

interface FrameStats {
    frames: number;
    fps: number;
    p50: number;
    p95: number;
    p99: number;
    worst: number;
    jankyPct: number;
    longTaskMs: number;
    scriptMs: number;
    styleLayoutMs: number;
}

declare global {
    interface Window {
        benchState?: { deltas: number[]; longTaskMs: number; running: boolean };
    }
}

function syntheticDuties(count: number) {
    const pharmacies = Array.from({ length: count }, (_, index) => {
        // Spread across Turkey with a dense cluster around Istanbul.
        const dense = index % 3 === 0;
        const lat = dense
            ? 40.85 + Math.random() * 0.35
            : 36.2 + Math.random() * 5.6;
        const lng = dense
            ? 28.7 + Math.random() * 0.7
            : 26.5 + Math.random() * 17.5;
        return {
            id: index + 1,
            name: `TEST ${index + 1}`,
            district: 'Merkez',
            city: 'İstanbul',
            address: 'Test Mah. No: 1',
            phone: '02120000000',
            lat,
            lng,
            startsAt: null,
            endsAt: null,
        };
    });
    return { date: '2026-11-04', pharmacies, missingCities: [] };
}

async function openPage(
    browser: Browser,
    url: string,
    variant: 'old' | 'new',
    stress: number
): Promise<Page> {
    const context = await browser.newContext({
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
        locale: 'tr-TR',
        geolocation: LOCATION,
        permissions: ['geolocation'],
        userAgent:
            'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
    });
    // The MapTiler key only serves the production origin. The live site is
    // already there; a local build gets its MapTiler requests replayed with
    // that origin. (Overriding Referer on `continue` is ignored by Chromium.)
    if (!url.startsWith('https://nobetcim.app')) {
        await context.route('https://api.maptiler.com/**', async (route) => {
            const response = await route.fetch({
                headers: {
                    ...route.request().headers(),
                    referer: 'https://nobetcim.app/',
                    origin: 'https://nobetcim.app',
                },
            });
            await route.fulfill({ response });
        });
    }
    // Analytics would count benchmark runs as visits.
    await context.route('https://api.invisit.dev/**', (route) => route.abort());
    if (variant === 'new' && stress > 0) {
        const body = JSON.stringify(syntheticDuties(stress));
        await context.route('**/api/duties*', (route) =>
            route.fulfill({ contentType: 'application/json', body })
        );
    }

    const page = await context.newPage();
    await page.addInitScript(() => {
        window.benchState = { deltas: [], longTaskMs: 0, running: false };
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (window.benchState?.running) {
                    window.benchState.longTaskMs += entry.duration - 50;
                }
            }
        }).observe({ type: 'longtask', buffered: false });
        let last = 0;
        const tick = (now: number) => {
            const bench = window.benchState;
            if (bench?.running && last) bench.deltas.push(now - last);
            last = now;
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (variant === 'old') {
        await page.getByRole('button', { name: 'Konum İzni Ver' }).click();
        await page
            .locator('[aria-label^="Eczane:"]')
            .first()
            .waitFor({ timeout: 30_000 });
    } else {
        await page.locator('canvas.maplibregl-canvas').waitFor();
        await page
            .getByText('Size en yakın nöbetçiler')
            .waitFor({ timeout: 30_000 });
    }
    // Let the initial fly-to and tile loading settle.
    await page
        .waitForLoadState('networkidle', { timeout: 30_000 })
        .catch(() => {});
    await page.waitForTimeout(4000);
    return page;
}

async function gestureScript(page: Page) {
    const { width, height } = page.viewportSize() ?? {
        width: 412,
        height: 915,
    };
    const cx = width / 2;
    const cy = height * 0.4;
    const pans: [number, number][] = [
        [-160, 0],
        [160, 120],
        [0, -200],
        [200, 80],
        [-200, 0],
        [0, 200],
    ];
    for (const [dx, dy] of pans) {
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + dx, cy + dy, { steps: 36 });
        await page.mouse.up();
        await page.waitForTimeout(350);
    }
    for (const delta of [-300, -300, 300, 300, 300, -300]) {
        await page.mouse.move(cx, cy);
        for (let i = 0; i < 6; i++) {
            await page.mouse.wheel(0, delta / 6);
            await page.waitForTimeout(16);
        }
        await page.waitForTimeout(500);
    }
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
    return sorted[index] ?? 0;
}

async function measure(page: Page, cpuRate: number): Promise<FrameStats> {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    await cdp.send('Performance.enable');
    const metric = async () => {
        const { metrics } = await cdp.send('Performance.getMetrics');
        const get = (name: string) =>
            metrics.find((m) => m.name === name)?.value ?? 0;
        return {
            script: get('ScriptDuration'),
            style: get('RecalcStyleDuration') + get('LayoutDuration'),
        };
    };

    const before = await metric();
    await page.evaluate(() => {
        if (window.benchState) {
            window.benchState.deltas = [];
            window.benchState.longTaskMs = 0;
            window.benchState.running = true;
        }
    });
    const startedAt = performance.now();
    await gestureScript(page);
    const elapsed = performance.now() - startedAt;
    const { deltas, longTaskMs } = await page.evaluate(() => {
        const bench = window.benchState;
        if (bench) bench.running = false;
        return {
            deltas: bench?.deltas ?? [],
            longTaskMs: bench?.longTaskMs ?? 0,
        };
    });
    const after = await metric();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const sorted = deltas.toSorted((a, b) => a - b);
    return {
        frames: deltas.length,
        fps: (deltas.length / elapsed) * 1000,
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        p99: percentile(sorted, 0.99),
        worst: sorted.at(-1) ?? 0,
        jankyPct:
            (deltas.filter((d) => d > 33.4).length /
                Math.max(1, deltas.length)) *
            100,
        longTaskMs,
        scriptMs: (after.script - before.script) * 1000,
        styleLayoutMs: (after.style - before.style) * 1000,
    };
}

function median(values: number[]): number {
    const sorted = values.toSorted((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function summarize(runs: FrameStats[]): FrameStats {
    const keys = Object.keys(runs[0] ?? {}) as (keyof FrameStats)[];
    return Object.fromEntries(
        keys.map((key) => [key, median(runs.map((run) => run[key]))])
    ) as unknown as FrameStats;
}

async function runVariant(
    browser: Browser,
    label: string,
    url: string,
    variant: 'old' | 'new',
    stress: number
) {
    const runs: FrameStats[] = [];
    const runCount = Number(args.runs);
    for (let run = 0; run < runCount; run++) {
        const page = await openPage(browser, url, variant, stress);
        const visibleMarkers =
            variant === 'old'
                ? await page.locator('[aria-label^="Eczane:"]').count()
                : null;
        runs.push(await measure(page, Number(args.cpu)));
        if (run === 0) {
            await page.screenshot({
                path: new URL(`${label}.png`, RESULTS_DIR).pathname,
            });
        }
        console.info(
            `${label} run ${run + 1}/${runCount}: ${runs.at(-1)?.fps.toFixed(1)} fps` +
                (visibleMarkers === null
                    ? ''
                    : ` (${visibleMarkers} DOM markers)`)
        );
        await page.context().close();
    }
    return { label, ...summarize(runs) };
}

await mkdir(RESULTS_DIR, { recursive: true });
const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const variants: [string, string, 'old' | 'new', number][] = [
    ['old', args.old ?? '', 'old', 0],
    ['new', args.new ?? '', 'new', 0],
];
const stress = Number(args.stress);
if (stress > 0) variants.push([`new-${stress}`, args.new ?? '', 'new', stress]);

const results = [];
for (const [label, url, variant, count] of variants) {
    if (args.only && !label.startsWith(args.only)) continue;
    results.push(await runVariant(browser, label, url, variant, count));
}
await browser.close();

console.table(
    results.map((r) => ({
        variant: r.label,
        fps: r.fps.toFixed(1),
        'p50 ms': r.p50.toFixed(1),
        'p95 ms': r.p95.toFixed(1),
        'p99 ms': r.p99.toFixed(1),
        'worst ms': r.worst.toFixed(0),
        'janky %': r.jankyPct.toFixed(1),
        'long task ms': r.longTaskMs.toFixed(0),
        'script ms': r.scriptMs.toFixed(0),
        'style+layout ms': r.styleLayoutMs.toFixed(0),
    }))
);
await writeFile(
    new URL(`results-${Date.now()}.json`, RESULTS_DIR),
    JSON.stringify({ cpuThrottle: Number(args.cpu), results }, null, 2)
);
