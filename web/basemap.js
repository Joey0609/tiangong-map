import { $ } from "./ui.js";

const sources = {
  gaode: {
    vector:
      "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
    satellite:
      "https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
    labels:
      "https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
  },
  bing: {
    vector:
      "https://t1.dynamic.tiles.ditu.live.com/comp/ch/{q}?mkt=zh-CN&ur=CN&it=G,LA&og=767&n=z",
    satellite: "https://ecn.t3.tiles.virtualearth.net/tiles/a{q}.jpeg?g=1",
    labels:
      "https://t1.dynamic.tiles.ditu.live.com/comp/ch/{q}?mkt=zh-CN&ur=CN&it=Z,GF,L&og=767&n=z",
  },
};
export function basemap(map, onTheme) {
  let mode = "vector",
    provider = "gaode",
    labels = true;
  try {
    const s = JSON.parse(localStorage.getItem("tiangong.basemap"));
    if (s) {
      mode = s.mode === "satellite" ? "satellite" : "vector";
      provider = s.provider === "bing" ? "bing" : "gaode";
      labels = s.labels !== false;
    }
  } catch {}
  const group = L.layerGroup().addTo(map);
  function tiles(type) {
    const layer = L.tileLayer(sources[provider][type], {
      subdomains: ["1", "2", "3", "4"],
      maxZoom: 19,
      attribution:
        type === "labels"
          ? ""
          : provider === "gaode"
            ? "© 高德地图"
            : "© Microsoft Bing Maps",
    });
    if (provider === "bing")
      layer.getTileUrl = ({ x, y, z }) => {
        let key = "";
        for (let i = z - 1; i >= 0; i--)
          key += ((x >> i) & 1) + 2 * ((y >> i) & 1);
        return sources.bing[type].replace("{q}", key);
      };
    return layer;
  }
  function draw() {
    group.clearLayers();
    tiles(mode).addTo(group);
    if (mode === "satellite" && labels) tiles("labels").addTo(group);
    document.body.dataset.theme = mode;
    document
      .querySelectorAll("[data-base]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.base === mode)),
      );
    $("provider").value = provider;
    $("satLabels").checked = labels;
    $("labelOption").hidden = mode !== "satellite";
    onTheme(mode);
    try {
      localStorage.setItem(
        "tiangong.basemap",
        JSON.stringify({ mode, provider, labels }),
      );
    } catch {}
  }
  document.querySelectorAll("[data-base]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.base;
        draw();
      }),
  );
  $("provider").onchange = (e) => {
    provider = e.target.value;
    draw();
  };
  $("satLabels").onchange = (e) => {
    labels = e.target.checked;
    draw();
  };
  draw();
}
