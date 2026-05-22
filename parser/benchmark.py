#!/usr/bin/env python3
"""
Benchmark suites:
  1) city worker/delay (first 5 cities, no coords)
  2) coordinate worker/delay (first N coords from Adana)
  3) retry tuning (first 5 cities x multiple rounds)
"""

import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

import requests
from bs4 import BeautifulSoup

from city_mapping import get_city_name
from common import get_scrape_dates

BASE_URL = "https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama"
TEST_CITIES = ["1", "2", "3", "4", "5"]
COORD_SAMPLE_SIZE = 12
COORD_CITY = "1"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    "Referer": BASE_URL,
}


@dataclass(frozen=True)
class CityConfig:
    name: str
    workers: int = 1
    submit_delay: float = 0.0
    results_delay: float = 0.0
    city_delay: float = 0.0
    timeout: int = 10


@dataclass(frozen=True)
class CoordConfig:
    name: str
    workers: int = 1
    coord_delay: float = 1.0
    timeout: int = 10


@dataclass(frozen=True)
class RetryConfig:
    name: str
    max_retries: int = 3
    retry_backoff: float = 1.0
    workers: int = 2
    submit_delay: float = 0.0
    results_delay: float = 0.3
    city_delay: float = 0.0
    rounds: int = 3


def parse_html(content):
    try:
        return BeautifulSoup(content, "lxml")
    except Exception:
        return BeautifulSoup(content, "html.parser")


def setup_city_session(http, tarih, plaka, timeout=10):
    r = http.get(BASE_URL, timeout=timeout)
    soup = parse_html(r.content)
    token = soup.body.get("data-token") if soup.body else None
    if not token:
        raise RuntimeError("no token")

    payload = {
        "ilkod": plaka,
        "ilkod-address-il": plaka,
        "ilkod-address-ilce": "",
        "nobetTarihi": tarih,
        "token": token,
        "btn": "Sorgula",
    }
    http.post(f"{BASE_URL}?submit", data=payload, timeout=timeout)
    r3 = http.get(f"{BASE_URL}?nobetci=Eczaneler", timeout=timeout)
    table = parse_html(r3.content).find("table", {"id": "searchTable"})
    rows = table.find("tbody").find_all("tr") if table and table.find("tbody") else []
    return len(rows)


def setup_city_session_safe(http, tarih, plaka, timeout=10):
    try:
        return setup_city_session(http, tarih, plaka, timeout), None
    except requests.RequestException as e:
        return 0, type(e).__name__
    except Exception as e:
        return 0, type(e).__name__


def fetch_coord(http, index, coord_delay, timeout):
    url = f"{BASE_URL}?harita=Goster&index={index}"
    payload = {"harita": "Goster", "index": str(index)}
    try:
        r = http.post(url, data=payload, timeout=timeout)
        if r.status_code == 429:
            return index, None, None, "rate_limited"
        lat = re.search(r"var latti = parseFloat\(([\d\.]+)\);", r.text)
        lon = re.search(r"var longi = parseFloat\(([\d\.]+)\);", r.text)
        if lat and lon:
            if coord_delay:
                time.sleep(coord_delay)
            return index, float(lat.group(1)), float(lon.group(1)), None
        return index, None, None, "no_coords"
    except requests.RequestException as e:
        return index, None, None, type(e).__name__


def scrape_city_once(http, tarih, plaka, submit_delay, results_delay, timeout):
    detail = {
        "plaka": plaka,
        "count": 0,
        "success": False,
        "error": None,
        "status": None,
        "retryable": False,
    }

    try:
        r = http.get(BASE_URL, timeout=timeout)
        detail["status"] = r.status_code
        if r.status_code == 429:
            detail["error"] = "rate_limited"
            detail["retryable"] = True
            return detail

        soup = parse_html(r.content)
        token = soup.body.get("data-token") if soup.body else None
        if not token:
            detail["error"] = "no_token"
            detail["retryable"] = True
            return detail

        if submit_delay:
            time.sleep(submit_delay)

        payload = {
            "ilkod": plaka,
            "ilkod-address-il": plaka,
            "ilkod-address-ilce": "",
            "nobetTarihi": tarih,
            "token": token,
            "btn": "Sorgula",
        }
        r2 = http.post(f"{BASE_URL}?submit", data=payload, timeout=timeout)
        detail["status"] = r2.status_code
        if r2.status_code == 429:
            detail["error"] = "rate_limited"
            detail["retryable"] = True
            return detail

        if results_delay:
            time.sleep(results_delay)

        r3 = http.get(f"{BASE_URL}?nobetci=Eczaneler", timeout=timeout)
        if r3.status_code == 429:
            detail["error"] = "rate_limited"
            detail["retryable"] = True
            return detail

        table = parse_html(r3.content).find("table", {"id": "searchTable"})
        rows = table.find("tbody").find_all("tr") if table and table.find("tbody") else []
        detail["count"] = len(rows)
        detail["success"] = True
    except requests.RequestException as e:
        detail["error"] = type(e).__name__
        detail["retryable"] = True
    except Exception as e:
        detail["error"] = type(e).__name__
        detail["retryable"] = True

    return detail


def scrape_city_with_retry(http, tarih, plaka, cfg: RetryConfig):
    t0 = time.time()
    last = None

    for attempt in range(cfg.max_retries):
        last = scrape_city_once(
            http, tarih, plaka, cfg.submit_delay, cfg.results_delay, 10
        )
        if last["success"]:
            last["attempts"] = attempt + 1
            last["took"] = round(time.time() - t0, 2)
            return last

        if not last.get("retryable") or attempt == cfg.max_retries - 1:
            break

        time.sleep(cfg.retry_backoff * (attempt + 1))

    last["attempts"] = cfg.max_retries
    last["took"] = round(time.time() - t0, 2)
    return last


def run_city_workers(cfg: CityConfig, tarih: str):
    started = time.time()
    results = []

    def worker(plaka):
        http = requests.Session()
        http.headers.update(HEADERS)
        out = scrape_city_once(
            http, tarih, plaka, cfg.submit_delay, cfg.results_delay, cfg.timeout
        )
        out["city"] = get_city_name(plaka)
        if cfg.city_delay:
            time.sleep(cfg.city_delay)
        return out

    if cfg.workers == 1:
        for plaka in TEST_CITIES:
            results.append(worker(plaka))
    else:
        with ThreadPoolExecutor(max_workers=cfg.workers) as pool:
            futures = [pool.submit(worker, p) for p in TEST_CITIES]
            for f in as_completed(futures):
                results.append(f.result())

    results.sort(key=lambda r: int(r["plaka"]))
    elapsed = round(time.time() - started, 2)
    return {
        "name": cfg.name,
        "elapsed": elapsed,
        "ok": sum(1 for r in results if r["success"]),
        "failed": sum(1 for r in results if not r["success"]),
        "rows": sum(r["count"] for r in results if r["success"]),
        "rate_limited": sum(1 for r in results if r.get("error") == "rate_limited"),
        "results": results,
    }


def run_coord_benchmark(cfg: CoordConfig, tarih: str, indices):
    started = time.time()
    results = []

    if cfg.workers == 1:
        http = requests.Session()
        http.headers.update(HEADERS)
        row_count, setup_error = setup_city_session_safe(http, tarih, COORD_CITY, cfg.timeout)
        if row_count == 0:
            return {
                "name": cfg.name,
                "elapsed": round(time.time() - started, 2),
                "ok": 0,
                "failed": len(indices),
                "total": len(indices),
                "rate_limited": 0,
                "setup_error": setup_error,
            }
        for index in indices:
            results.append(fetch_coord(http, index, cfg.coord_delay, cfg.timeout))
    else:

        def worker(index):
            http = requests.Session()
            http.headers.update(HEADERS)
            row_count, setup_error = setup_city_session_safe(http, tarih, COORD_CITY, cfg.timeout)
            if row_count == 0:
                return index, None, None, setup_error or "setup_failed"
            return fetch_coord(http, index, cfg.coord_delay, cfg.timeout)

        with ThreadPoolExecutor(max_workers=cfg.workers) as pool:
            futures = [pool.submit(worker, i) for i in indices]
            for f in as_completed(futures):
                results.append(f.result())

    results.sort(key=lambda r: r[0])
    elapsed = round(time.time() - started, 2)
    ok = sum(1 for r in results if r[1] is not None and r[2] is not None)
    return {
        "name": cfg.name,
        "elapsed": elapsed,
        "ok": ok,
        "failed": len(results) - ok,
        "total": len(results),
        "rate_limited": sum(1 for r in results if r[3] == "rate_limited"),
    }


def run_retry_benchmark(cfg: RetryConfig, tarih: str):
    started = time.time()
    all_results = []

    for round_num in range(1, cfg.rounds + 1):
        round_results = []

        def worker(plaka):
            http = requests.Session()
            http.headers.update(HEADERS)
            out = scrape_city_with_retry(http, tarih, plaka, cfg)
            out["city"] = get_city_name(plaka)
            out["round"] = round_num
            if cfg.city_delay:
                time.sleep(cfg.city_delay)
            return out

        if cfg.workers == 1:
            for plaka in TEST_CITIES:
                round_results.append(worker(plaka))
        else:
            with ThreadPoolExecutor(max_workers=cfg.workers) as pool:
                futures = [pool.submit(worker, p) for p in TEST_CITIES]
                for f in as_completed(futures):
                    round_results.append(f.result())

        all_results.extend(sorted(round_results, key=lambda r: int(r["plaka"])))

    elapsed = round(time.time() - started, 2)
    return {
        "name": cfg.name,
        "elapsed": elapsed,
        "ok": sum(1 for r in all_results if r["success"]),
        "failed": sum(1 for r in all_results if not r["success"]),
        "total_attempts": len(all_results),
        "avg_attempts": round(
            sum(r.get("attempts", 1) for r in all_results) / len(all_results), 2
        ),
        "results": all_results,
    }


def print_city_suite(summaries):
    print("\n" + "=" * 72)
    print("SUITE 1: CITY WORKER/DELAY (5 cities, no coords)")
    print("=" * 72)
    print(f"{'config':<30} {'time':>6} {'ok':>4} {'fail':>5} {'rows':>5} {'429':>4}")
    for s in summaries:
        print(
            f"{s['name']:<30} {s['elapsed']:>5.1f}s {s['ok']:>4} {s['failed']:>5} "
            f"{s['rows']:>5} {s['rate_limited']:>4}"
        )


def print_coord_suite(summaries):
    print("\n" + "=" * 72)
    print(f"SUITE 2: COORD BENCHMARK ({COORD_SAMPLE_SIZE} coords from Adana)")
    print("=" * 72)
    print(f"{'config':<30} {'time':>6} {'ok':>4} {'fail':>5} {'429':>4}")
    for s in summaries:
        print(
            f"{s['name']:<30} {s['elapsed']:>5.1f}s {s['ok']:>4}/{s['total']} "
            f"{s['failed']:>5} {s['rate_limited']:>4}"
        )


def print_retry_suite(summaries):
    print("\n" + "=" * 72)
    print("SUITE 3: RETRY TUNING (5 cities x 3 rounds)")
    print("=" * 72)
    print(f"{'config':<30} {'time':>6} {'ok':>7} {'fail':>5} {'avgAtt':>7}")
    for s in summaries:
        print(
            f"{s['name']:<30} {s['elapsed']:>5.1f}s {s['ok']:>3}/{s['total_attempts']} "
            f"{s['failed']:>5} {s['avg_attempts']:>7}"
        )


def pick_best_city(summaries):
    perfect = [s for s in summaries if s["failed"] == 0 and s["rows"] >= 70]
    if not perfect:
        perfect = [s for s in summaries if s["failed"] == 0]
    if not perfect:
        return min(summaries, key=lambda s: (s["failed"], -s["rows"], s["elapsed"]))
    return min(perfect, key=lambda s: s["elapsed"])


def pick_best_coord(summaries):
    viable = [s for s in summaries if s.get("ok", 0) > 0]
    if not viable:
        return min(summaries, key=lambda s: (s["failed"], s["elapsed"]))
    perfect = [s for s in viable if s["failed"] == 0]
    pool = perfect if perfect else viable
    return max(pool, key=lambda s: (s["ok"], -s["elapsed"]))


def pick_best_retry(summaries):
    perfect = [s for s in summaries if s["failed"] == 0]
    if not perfect:
        return min(summaries, key=lambda s: (s["failed"], s["elapsed"]))
    return min(perfect, key=lambda s: (s["avg_attempts"], s["elapsed"]))


def run_final_validation(tarih, city_cfg, coord_cfg, retry_cfg):
    print("\n" + "=" * 72)
    print("FINAL VALIDATION (2 rounds city+retry, 12 coords)")
    print("=" * 72)

    retry = RetryConfig(
        name="final",
        max_retries=retry_cfg.max_retries,
        retry_backoff=retry_cfg.retry_backoff,
        workers=city_cfg.workers,
        submit_delay=city_cfg.submit_delay,
        results_delay=city_cfg.results_delay,
        rounds=2,
    )
    city_result = run_retry_benchmark(retry, tarih)

    http = requests.Session()
    http.headers.update(HEADERS)
    row_count = setup_city_session(http, tarih, COORD_CITY)
    indices = list(range(min(COORD_SAMPLE_SIZE, row_count)))
    coord_result = run_coord_benchmark(coord_cfg, tarih, indices)

    print(
        f"City+retry: ok={city_result['ok']}/{city_result['total_attempts']} "
        f"fail={city_result['failed']} time={city_result['elapsed']}s"
    )
    print(
        f"Coords: ok={coord_result['ok']}/{coord_result['total']} "
        f"fail={coord_result['failed']} time={coord_result['elapsed']}s "
        f"429={coord_result['rate_limited']}"
    )
    return city_result["failed"] == 0 and coord_result["failed"] == 0


def main():
    tarih = get_scrape_dates()[0]
    print(f"Benchmark date: {tarih}")

    city_configs = [
        CityConfig("w2 d0", workers=2),
        CityConfig("w3 d0", workers=3),
        CityConfig("w2 r0.3", workers=2, results_delay=0.3),
        CityConfig("w3 r0.3", workers=3, results_delay=0.3),
        CityConfig("w2 s0.3 r0.3", workers=2, submit_delay=0.3, results_delay=0.3),
        CityConfig("w1 r0.3", workers=1, results_delay=0.3),
    ]
    city_summaries = [run_city_workers(c, tarih) for c in city_configs]
    print_city_suite(city_summaries)

    coord_configs = [
        CoordConfig("seq d1.0 (current)", workers=1, coord_delay=1.0),
        CoordConfig("seq d0.5", workers=1, coord_delay=0.5),
        CoordConfig("seq d0.3", workers=1, coord_delay=0.3),
        CoordConfig("seq d0", workers=1, coord_delay=0.0),
        CoordConfig("w2 d0.3", workers=2, coord_delay=0.3),
        CoordConfig("w2 d0", workers=2, coord_delay=0.0),
        CoordConfig("w3 d0.3", workers=3, coord_delay=0.3),
        CoordConfig("w3 d0", workers=3, coord_delay=0.0),
    ]

    http = requests.Session()
    http.headers.update(HEADERS)
    row_count = setup_city_session(http, tarih, COORD_CITY)
    indices = list(range(min(COORD_SAMPLE_SIZE, row_count)))
    print(f"\nPrepared {len(indices)} coord indices from Adana ({row_count} rows)")

    coord_summaries = []
    for c in coord_configs:
        coord_summaries.append(run_coord_benchmark(c, tarih, indices))
        time.sleep(1)
    print_coord_suite(coord_summaries)

    retry_configs = [
        RetryConfig("r1 b0 w2", max_retries=1, retry_backoff=0, workers=2),
        RetryConfig("r3 b1 w2", max_retries=3, retry_backoff=1, workers=2),
        RetryConfig("r3 b2 w2", max_retries=3, retry_backoff=2, workers=2),
        RetryConfig("r5 b1 w2", max_retries=5, retry_backoff=1, workers=2),
        RetryConfig("r5 b2 w2", max_retries=5, retry_backoff=2, workers=2),
        RetryConfig("r5 b1 w3", max_retries=5, retry_backoff=1, workers=3, results_delay=0),
    ]
    retry_summaries = [run_retry_benchmark(c, tarih) for c in retry_configs]
    print_retry_suite(retry_summaries)

    best_city_cfg = next(c for c in city_configs if c.name == pick_best_city(city_summaries)["name"])
    best_coord_cfg = next(c for c in coord_configs if c.name == pick_best_coord(coord_summaries)["name"])
    best_retry_cfg = next(c for c in retry_configs if c.name == pick_best_retry(retry_summaries)["name"])

    print("\n" + "=" * 72)
    print("RECOMMENDED")
    print("=" * 72)
    print(
        f"City:  workers={best_city_cfg.workers} "
        f"submit_delay={best_city_cfg.submit_delay} results_delay={best_city_cfg.results_delay}"
    )
    print(
        f"Coord: workers={best_coord_cfg.workers} coord_delay={best_coord_cfg.coord_delay}"
    )
    print(
        f"Retry: max_retries={best_retry_cfg.max_retries} "
        f"backoff={best_retry_cfg.retry_backoff} workers={best_retry_cfg.workers}"
    )

    passed = run_final_validation(tarih, best_city_cfg, best_coord_cfg, best_retry_cfg)
    print(f"\nFinal validation: {'PASS' if passed else 'FAIL'}")


if __name__ == "__main__":
    main()
