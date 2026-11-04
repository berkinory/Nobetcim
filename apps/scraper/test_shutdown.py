import datetime
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import main


class ShutdownTests(unittest.TestCase):
    def tearDown(self):
        main.stop_requested.clear()

    def test_idle_scheduler_exits_on_sigterm(self):
        with tempfile.TemporaryDirectory() as directory:
            ready = Path(directory) / "ready"
            code = (
                "import main; from pathlib import Path; "
                f"main.run_cycle = lambda: Path({str(ready)!r}).touch(); "
                "main.main()"
            )
            child = subprocess.Popen(
                [sys.executable, "-c", code],
                cwd=Path(__file__).parent,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            try:
                deadline = time.monotonic() + 5
                while not ready.exists():
                    if child.poll() is not None or time.monotonic() > deadline:
                        self.fail("scheduler did not become ready")
                    time.sleep(0.01)
                child.send_signal(signal.SIGTERM)
                self.assertEqual(child.wait(timeout=3), 0)
            finally:
                if child.poll() is None:
                    child.kill()
                    child.wait()
                child.stderr.close()

    def test_active_city_is_saved_and_queued_cities_do_not_start(self):
        started = threading.Event()
        release = threading.Event()
        cities = []
        saved = []

        def scrape(date, plate):
            cities.append(plate)
            started.set()
            if not release.wait(3):
                raise TimeoutError("test city was not released")
            saved.append(plate)
            return main.CityResult(plate, "ok")

        with (
            patch.object(main, "scrape_city", scrape),
            patch.object(main, "CITY_WORKER_COUNT", 1),
            patch.object(main, "due_plate_codes", return_value=[1, 2, 3]),
        ):
            worker = threading.Thread(
                target=main.process_date, args=(datetime.date(2026, 1, 1), {})
            )
            worker.start()
            try:
                self.assertTrue(started.wait(3))
                main.request_shutdown(signal.SIGTERM, None)
            finally:
                release.set()
                worker.join(timeout=3)
            self.assertFalse(worker.is_alive())
            self.assertEqual(cities, [1])
            self.assertEqual(saved, [1])


if __name__ == "__main__":
    unittest.main()
