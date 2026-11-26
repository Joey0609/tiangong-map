import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from .http import get

MISSIONS = [f"https://www.cmse.gov.cn/fxrw/SZ{n}/" for n in (23, 24)]


def news(previous):
    items = {item["url"]: item for item in previous.get("items", [])}
    for page in MISSIONS:
        soup = BeautifulSoup(get(page), "html.parser")
        found = 0
        for a in soup.select("a[href]"):
            url = urljoin(page, a["href"])
            day = re.search(r"/t(\d{4})(\d\d)(\d\d)_\d+\.html$", url)
            title = a.get_text(" ", strip=True)
            if not day or len(title) < 7 or urlparse(url).hostname != "www.cmse.gov.cn":
                continue
            found += 1
            items[url] = {"url": url, "date": "-".join(day.groups()), "title": title}
        if not found:
            raise ValueError("任务栏目未返回可识别公告")
    return {"items": sorted(items.values(), key=lambda item: (item["date"], item["url"]), reverse=True)[:100]}
