import urllib.request


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "TiangongMap/1.0 (public mission viewer)"})
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read()
