import os
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
            ready = Path(directory) / 'ready'
            code = (
                'import main; from pathlib import Path; '
                f'main.process_active_dates = lambda: Path({str(ready)!r}).touch(); '
                'main.main()'
            )
            child = subprocess.Popen([sys.executable, '-c', code], cwd=Path(__file__).parent,
                                     stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            try:
                deadline = time.monotonic() + 5
                while not ready.exists():
                    if child.poll() is not None or time.monotonic() > deadline:
                        self.fail('scheduler did not become ready')
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

        class Session:
            def __init__(self, date):
                pass

            def start(self):
                return True

            def scrape_city(self, plate):
                cities.append(plate)
                started.set()
                if not release.wait(3):
                    raise TimeoutError('test city was not released')
                return {'success': True, 'tooktime': 0, 'count': 0, 'list': []}

        with patch.object(main, 'ScrapeSession', Session), \
             patch.object(main, 'CITY_WORKER_COUNT', 1), \
             patch.object(main, 'pending_plate_codes', return_value=['1', '2', '3']), \
             patch.object(main, 'load_completed_cities', return_value=set()), \
             patch.object(main, 'check_db_connection', return_value=True), \
             patch.object(main, 'save_city_pharmacies', side_effect=lambda date, plate, rows: saved.append(plate) or True):
            worker = threading.Thread(target=main.process_single_date, args=('01/01/2026',))
            worker.start()
            try:
                self.assertTrue(started.wait(3))
                main.request_shutdown(signal.SIGTERM, None)
            finally:
                release.set()
                worker.join(timeout=3)
            self.assertFalse(worker.is_alive())
            self.assertEqual(cities, ['1'])
            self.assertEqual(saved, ['1'])


if __name__ == '__main__':
    unittest.main()
