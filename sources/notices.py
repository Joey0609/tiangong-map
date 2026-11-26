import json
import re
from datetime import datetime, timezone
from .http import get
from .notam_geometry import geometry_circle, geometry_points

NOTAMS = "https://joey0609.github.io/notams/data_dict.json"


def advisory_time(s):
    # English month names independent of Windows locale.
    fmt = re.fullmatch(r"(\d{1,2}) ([A-Z]{3}) (\d\d):(\d\d) (\d{4})", s.strip().upper())
    if not fmt:
        return None
    day, month, hour, minute, year = fmt.groups()
    months = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split()
    return int(datetime(int(year), months.index(month)+1, int(day), int(hour), int(minute),
                        tzinfo=timezone.utc).timestamp()*1000)


def notices(previous):
    feed = json.loads(get(NOTAMS))
    if not feed.get("FETCH_VALID"):
        raise ValueError("上游标记抓取无效")
    records = []
    for key in ("FOCUSED_NOTAM_DATA", "NOTAM_DATA", "MSI_DATA", "CHINA_MSA_DATA", "USCG_NOTMAR_DATA"):
        d = feed.get(key, {})
        for i in range(d.get("NUM", 0)):
            def col(k):
                vals = d.get(k, [])
                return vals[i] if i < len(vals) else ""
            time = str(col("TIME"))
            dates = time.split(" UNTIL ")
            period = [advisory_time(s) for s in dates] if len(dates) == 2 else []
            shape = col("GEOMETRY")
            records.append({"code": col("CODE"), "id": col("PLATID"), "text": col("RAWMESSAGE"),
                            "time": time, "period": period, "source": col("SOURCE"),
                            "circle": geometry_circle(shape), "points": geometry_points(shape)})
    return {"items": records, "partial": feed.get("FAILED_SOURCES", []), "url": NOTAMS}
