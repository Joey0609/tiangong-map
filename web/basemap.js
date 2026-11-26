import { $ } from "./ui.js";

// Same Gaode layers as the vector/satellite buttons in Joey0609/notams.
const tiles = {
  vector: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
  satellite: "https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
  labels: "https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
};

export function basemap(map, onTheme) {
  let mode = "vector", labels = true;
  try {
    const saved = JSON.parse(localStorage.getItem("tiangong.basemap"));
    if (saved) {
      mode = saved.mode === "satellite" ? "satellite" : "vector";
      labels = saved.labels !== false;
    }
  } catch {}
  const group = L.layerGroup().addTo(map);
  const buttons = document.querySelectorAll("[data-base]");
  function add(type) {
    L.tileLayer(tiles[type], {
      subdomains: ["1", "2", "3", "4"], maxZoom: 19,
      attribution: type === "labels" ? "" : "© 高德地图",
    }).addTo(group);
  }
  function draw() {
    group.clearLayers();
    add(mode);
    if (mode === "satellite" && labels) add("labels");
    document.body.dataset.theme = mode;
    buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.base === mode)));
    $("satLabels").checked = labels;
    $("labelOption").hidden = mode !== "satellite";
    onTheme(mode);
    try {
      localStorage.setItem("tiangong.basemap", JSON.stringify({ mode, labels }));
    } catch {}
  }
  buttons.forEach(b => { b.onclick = () => { mode = b.dataset.base; draw(); }; });
  $("satLabels").onchange = e => { labels = e.target.checked; draw(); };
  draw();
}
