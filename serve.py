import argparse
import json
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from collector import DATA, ROOT, refresh

lock = threading.Lock()
last_check = 0.0


def update(minimum_age):
    global last_check
    with lock:
        if time.monotonic() - last_check >= minimum_age or not (DATA / "latest.json").exists():
            refresh()
            last_check = time.monotonic()


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_POST(self):
        if urlsplit(self.path).path != "/api/refresh":
            return self.send_error(404)
        origin = self.headers.get("Origin")
        if origin and urlsplit(origin).netloc != self.headers.get("Host"):
            return self.send_error(403)
        try:
            update(60)
        except Exception:
            return self.send_error(503, "Collector unavailable")
        self.send_response(200)
        self.end_headers()
        self.wfile.write(json.dumps({"updated": True}).encode())


def scheduled():
    while True:
        try:
            update(60)
        except Exception as exc:
            print("Refresh failed:", exc, flush=True)
        time.sleep(900)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    http = ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=ROOT / "web"))
    threading.Thread(target=scheduled, daemon=True).start()
    print(f"http://127.0.0.1:{args.port}/", flush=True)
    http.serve_forever()

