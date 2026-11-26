import concurrent.futures
import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from sources.ephemeris import orbit
from sources.bulletins import news
from sources.notices import notices

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "web" / "data"


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False, encoding="utf8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    os.replace(f.name, path)


def refresh():
    path = DATA / "latest.json"
    old = json.loads(path.read_text(encoding="utf8")) if path.exists() else {}
    result = {"updated": now()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {pool.submit(fn, old.get(key, {}).get("data", {})): key for key, fn in
                (("orbit", orbit), ("notices", notices), ("news", news))}
        for task, key in jobs.items():
            previous = old.get(key, {})
            try:
                value = task.result()
                checked = now()
                result[key] = {"data": value, "success": checked, "error": ""}
                if value != previous.get("data"):
                    digest = hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:12]
                    dest = DATA / "history" / key / (checked[:10] + "-" + digest + ".json")
                    if not dest.exists():
                        save(dest, {"collected": checked, "data": value})
            except Exception as exc:
                result[key] = {**previous, "error": str(exc)[:220]}
    save(path, result)
    return result


if __name__ == "__main__":
    for key, value in refresh().items():
        if isinstance(value, dict):
            print(key, value.get("error") or "OK")

