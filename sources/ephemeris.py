import io
import re
import zipfile
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import erfa
import numpy as np
from bs4 import BeautifulSoup
from .http import get

OEM = "https://www.cmse.gov.cn/gfgg/zgkjzgdcs/"


def parse_oem(raw):
    metadata = dict(re.findall(r"^\s*(\w+)\s*=\s*([^\r\n]+)", raw, re.M))
    if [metadata.get(k, "").strip() for k in ("REF_FRAME", "TIME_SYSTEM", "CENTER_NAME", "OBJECT_ID")] != ["EME2000", "UTC", "EARTH", "CSS"]:
        raise ValueError("未知星历参考系或对象")
    rows = [line.split() for line in raw.splitlines() if re.match(r"^\s*\d{4}-\d{2}-\d{2}T", line)]
    times = np.array([datetime.fromisoformat(row[0]).replace(tzinfo=timezone.utc).timestamp() for row in rows])
    vectors = np.array([list(map(float, row[1:])) for row in rows])
    if len(rows) < 2 or vectors.shape[1] != 6 or np.any(np.diff(times) <= 0) or not np.isfinite(vectors).all():
        raise ValueError("星历记录无效")

    def terrestrial_matrix(t):
        # UTC approximates UT1. Sub-km public visualization; polar motion omitted.
        days = t / 86400.0
        tai = erfa.utctai(2440587.5, days)
        tt = erfa.taitt(*tai)
        return erfa.c2t06a(*tt, 2440587.5, days, 0.0, 0.0)

    rotation = terrestrial_matrix(times)
    rate = terrestrial_matrix(times + 0.5) - terrestrial_matrix(times - 0.5)
    pos, vel = vectors[:, :3], vectors[:, 3:]
    matvec = lambda m, v: np.einsum("nij,nj->ni", m, v)
    earth = np.column_stack((np.round(times * 1000), matvec(rotation, pos),
                             matvec(rotation, vel) + matvec(rate, pos)))
    return {"created": metadata["CREATION_DATE"].strip() + "Z",
            "rows": [[int(row[0]), *np.round(row[1:], 7)] for row in earth]}


def orbit(previous):
    soup = BeautifulSoup(get(OEM), "html.parser")
    urls = [urljoin(OEM, a["href"]) for a in soup.select("a[href]") if a["href"].lower().endswith(".zip")]
    url = next(u for u in urls if urlparse(u).hostname == "www.cmse.gov.cn")
    if previous.get("url") == url and previous.get("rows"):
        return previous
    with zipfile.ZipFile(io.BytesIO(get(url))) as z:
        entry = next(n for n in z.namelist() if n.lower().endswith((".dat", ".oem", ".txt")))
        result = parse_oem(z.read(entry).decode("ascii"))
    return {**result, "url": url, "index": OEM}
