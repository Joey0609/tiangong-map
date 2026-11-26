import { areaCenter } from './area-center.js';
import { noticeId, returnLabel, bindNotice } from "./advisories.js";
import { basemap } from "./basemap.js";
import { position, geodetic, observer } from "./orbit.js";
import { $, esc, toast, icon } from "./ui.js";

export function createMap() {
  const map = L.map("map", {
    zoomControl: false,
    zoomSnap: 1,
    minZoom: 3,
    maxZoom: 14,
    worldCopyJump: true,
    // Constrain latitude to the drawable Mercator surface; longitude wraps on drag.
    maxBounds: [[-85.05112878, -1e9], [85.05112878, 1e9]],
    maxBoundsViscosity: 1,
    preferCanvas: true,
  });
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('Natural Earth · Leaflet · 城市代标 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
  map.createPane("fallback");
  map.getPane("fallback").style.zIndex = 180;
  map.getPane("fallback").style.pointerEvents = "none";
  const land = L.layerGroup().addTo(map),
    grid = L.layerGroup().addTo(map),
    paths = L.layerGroup().addTo(map);
  const pins = L.layerGroup().addTo(map),
    areas = L.layerGroup().addTo(map);
  const noticeLayers = new Map(), hidden = new Set();
  let pendingPick = null;
  const connect = L.layerGroup().addTo(map);
  const marker = L.marker([0, 0], {
    icon: L.divIcon({
      className: "sat-icon",
      html: icon("satellite"),
      iconSize: [30, 30],
    }),
    zIndexOffset: 800,
  }).bindTooltip("天宫空间站", {
    permanent: true,
    direction: "right",
    offset: [10, 0],
  });
  let theme = "vector";
  const landStyle = () =>
    theme === "vector"
      ? { color: "#b6c6c1", weight: 0.7, fillColor: "#e7ecdf", fillOpacity: 1 }
      : { color: "#577172", weight: 0.7, fillColor: "#304d50", fillOpacity: 1 };
  let latest = null,
    pathKey = "",
    pinKey = "",
    noticeKey = "",
    lastOrbit = null,
    initial = true;
  function syncZoomControls() {
    $("zoomOut").disabled = map.getZoom() <= map.getMinZoom();
    $("zoomIn").disabled = map.getZoom() >= map.getMaxZoom();
  }
  function world() { map.setView([12, 32], map.getMinZoom()); }
  world();
  syncZoomControls();
  map.on("zoomend", syncZoomControls);
  map.on("moveend", () => {
    const center = map.getCenter();
    if (Math.abs(center.lng) > 180) map.setView(center.wrap(), map.getZoom(), { animate: false });
  });
  basemap(map, (m) => {
    theme = m;
    pathKey = "";
    land.eachLayer((l) => l.setStyle(landStyle()));
  });
  fetch("vendor/world.json")
    .then((r) => r.json())
    .then((d) => {
      for (const off of [-360, 0, 360]) {
        L.geoJSON(d, {
          coordsToLatLng: (c) => L.latLng(c[1], c[0] + off),
          pane: "fallback",
          style: landStyle(),
          interactive: false,
        }).addTo(land);
      }
      land.eachLayer((x) => x.bringToBack());
    })
    .catch(() => toast("底图读取失败"));
  const faint = {
    pane: "fallback",
    color: "#758d92",
    weight: 0.6,
    opacity: 0.24,
    interactive: false,
  };
  for (let x = -540; x <= 540; x += 30)
    L.polyline(
      [
        [-80, x],
        [80, x],
      ],
      faint,
    ).addTo(grid);
  for (let y = -75; y <= 75; y += 15)
    L.polyline(
      [
        [y, -540],
        [y, 540],
      ],
      faint,
    ).addTo(grid);
  for (const off of [-360, 0, 360])
    for (const [lat, lon, name] of [
      [48, 81, "亚 洲"],
      [54, 20, "欧 洲"],
      [3, 21, "非 洲"],
      [-24, 135, "大 洋 洲"],
      [48, -103, "北 美 洲"],
      [-12, -59, "南 美 洲"],
      [5, -145, "太 平 洋"],
      [-17, 76, "印 度 洋"],
      [19, -38, "大 西 洋"],
    ]) {
      L.marker([lat, lon + off], {
        pane: "fallback",
        interactive: false,
        keyboard: false,
        zIndexOffset: -100,
        icon: L.divIcon({
          className: "map-label",
          html: name,
          iconSize: [84, 20],
        }),
      }).addTo(grid);
    }
  const near = (lon, ref) => lon + 360 * Math.round((ref - lon) / 360);
  function dot(lat, lon, title, station) {
    return L.marker([lat, near(lon, map.getCenter().lng)], {
      icon: L.divIcon({
        className: "map-pin-icon",
        html: icon(station ? "radio-tower" : "map-pin"),
        iconSize: [22, 22],
      }),
    })
      .bindTooltip(esc(title))
      .addTo(pins);
  }
  function track(rows, time, minutes, style) {
    let coords = [],
      lastLon;
    const paint = () => {
      if (coords.length > 1)
        for (const off of [-360, 0, 360])
          L.polyline(
            coords.map(([y, x]) => [y, x + off]),
            { ...style, interactive: false },
          ).addTo(paths);
      coords = [];
      lastLon = undefined;
    };
    const first = minutes < 0 ? time + minutes * 60000 : time,
      end = minutes < 0 ? time : time + minutes * 60000;
    for (let t = first; t <= end; t += 30000) {
      const p = position(rows, t);
      if (!p) {
        paint();
        continue;
      }
      const g = geodetic(p),
        lon = near(g.lon, lastLon ?? g.lon);
      coords.push([g.lat, lon]);
      lastLon = lon;
    }
    paint();
  }
  function paint({
    rows,
    t,
    point,
    site,
    mission,
    notices,
    stationStates,
    version,
  }) {
    latest = point;
    const center = map.getCenter().lng,
      lng = point ? near(point.lon, center) : 0;
    if (initial && point) {
      initial = false;
      map.panTo([9, near(point.lon, 0) + (map.getSize().x > 700 ? 25 : 0)], {
        animate: false,
      });
    }
    if (point)
      marker
        .setLatLng([point.lat, near(point.lon, map.getCenter().lng)])
        .addTo(map);
    else marker.remove();
    if (rows !== lastOrbit) {
      lastOrbit = rows;
      pathKey = "";
    }
    const key = [Math.floor(t / 30000), $("trackOn").checked, theme].join();
    if (key !== pathKey) {
      pathKey = key;
      paths.clearLayers();
      if ($("trackOn").checked && point) {
        track(rows, t, -93, {
          color: theme === "vector" ? "#087259" : "#a1e4b7",
          weight: 2.7,
          opacity: 0.9,
        });
        track(rows, t, 93, {
          color: theme === "vector" ? "#ab4e13" : "#f1c581",
          weight: 2.5,
          dashArray: "5 7",
          opacity: 0.95,
        });
      }
    }
    const pkey = JSON.stringify([
      site,
      version,
      Math.round(center / 90),
      $("siteOn").checked,
      $("stationsOn").checked,
    ]);
    if (pkey !== pinKey) {
      pinKey = pkey;
      pins.clearLayers();
      if ($("siteOn").checked)
        dot(site.lat, site.lon, site.name, false).bindPopup(
          esc(site.name) + " · 固定观测点",
        );
      if ($("stationsOn").checked)
        for (const { s, located } of stationStates)
          if (located) dot(s.lat, s.lon, s.name, true).bindPopup(
            esc(s.name),
          );
          else if (s.cityReference) {
            const c = s.cityReference, title = s.name + " · 市政府代标";
            dot(c.lat, c.lon, title, false).bindPopup(esc(title) + "<br>" + esc(c.name));
          }
    }
    connect.clearLayers();
    function line(s, color, dash) {
      if (!point) return;
      const slon = near(s.lon, lng);
      L.polyline(
        [
          [s.lat, slon],
          [point.lat, lng],
        ],
        { color, weight: 1, opacity: 0.85, dashArray: dash, interactive: false },
      ).addTo(connect);
    }
    if (
      point &&
      $("siteOn").checked &&
      observer(site)(position(rows, t)).el >= site.mask
    )
      line(site, theme === "vector" ? "#226c65" : "#c1f1df", "3 4");
    if ($("stationsOn").checked)
      for (const { s, located, isUp, confirmed } of stationStates) {
        if (!located) continue;
        if (confirmed?.kind === "direct") line(s, "#399364", null);
        else if (isUp) line(s, theme === "vector" ? "#226c65" : "#c1f1df", "3 4");
      }
    if (!$("noticesOn").checked) hidden.clear();
    const nkey = JSON.stringify([
      version,
      notices.map((n) => [n.id, n.code, t < n.period[0]]),
      $("noticesOn").checked,
      Math.round(center / 90),
    ]);
    if (nkey !== noticeKey) {
      noticeKey = nkey;
      areas.clearLayers();
      noticeLayers.clear();
      if ($("noticesOn").checked)
        for (const n of notices) {
          const id = noticeId(n), label = returnLabel(n);
          if (hidden.has(id)) continue;
          const opts = label ? { color: "#b34570", weight: 2, fillOpacity: 0.23, dashArray: "6 3" } : { color: "#d9ac72", weight: 1.2, fillOpacity: 0.14 };
          const pending = t < n.period[0];
          if (pending) Object.assign(opts, { dashArray:'3 6', fillOpacity:0.08 });
          let l;
          if (n.circle) {
            const [[y, x], r] = n.circle;
            l = L.circle([y, near(x, center)], { ...opts, radius: r });
          } else if (n.points.length >= 3) {
            let last = center;
            l = L.polygon(
              n.points.map(([y, x]) => [y, (last = near(x, last))]),
              opts,
            );
          }
          if (l) {
            l.addTo(areas);
            noticeLayers.set(id, l);
            if (label) l.bindTooltip(esc(label) + ' · ' + esc(n.code), { permanent:true, direction:'center', className:'return-label' });
            const c = areaCenter(n);
            if (c) {
              const ref = L.circleMarker([c[0], near(c[1], center)], { radius:4, weight:2, color:'#fff', fillColor:'#763d81', fillOpacity:1, interactive:false });
              ref.addTo(map);
              l.once('remove', () => ref.remove());
            }
            if (!label) l.bindTooltip(esc(n.code) + (pending ? ' · 待生效' : ' · 公告窗口内'));
            bindNotice(l, n, () => { hidden.add(id); areas.removeLayer(l); noticeLayers.delete(id); });
          }
        }
    }
  }
  $("fit").onclick = world;
  $("locate").onclick = () =>
    latest
      ? map.setView([latest.lat, latest.lon], Math.max(3, map.getZoom()))
      : toast("所选时间无轨道数据");
  $("zoomIn").onclick = () => map.zoomIn(1);
  $("zoomOut").onclick = () => map.zoomOut(1);
  function finishPick(point) {
    if (!pendingPick) return;
    const done = pendingPick; pendingPick = null;
    map.getContainer().classList.remove('picking'); $("cancelPick").hidden = true;
    done(point);
  }
  map.on('click', e => { if (pendingPick) finishPick(e.latlng.wrap()); });
  $("cancelPick").onclick = () => finishPick(null);
  document.addEventListener('keydown', e => { if (pendingPick && e.key === 'Escape') { e.preventDefault(); finishPick(null); } });
  return {
    paint,
    pick(done) {
      pendingPick = done; map.closePopup(); map.getContainer().classList.add('picking');
      $("cancelPick").hidden = false; map.getContainer().focus();
    },
    focusNotice(n, redraw) {
      const id = noticeId(n); hidden.delete(id); $("noticesOn").checked = true;
      const c = areaCenter(n);
      if (!c) return;
      const middle = L.latLng(c[0], near(c[1], map.getCenter().lng));
      const extent = n.circle ? middle.toBounds(2 * n.circle[1]) : null;
      const vertices = extent ? [extent.getNorthWest(), extent.getSouthEast()] : n.points.map(([lat, lon]) => L.latLng(lat, near(lon, middle.lng)));
      // Fit symmetric projected extents so an asymmetric polygon stays in view
      // while its area centroid, not its bounding-box center, stays centered.
      const origin = map.project(middle, 0);
      let dx = 0, dy = 0;
      for (const vertex of vertices) {
        const d = map.project(vertex, 0).subtract(origin);
        dx = Math.max(dx, Math.abs(d.x)); dy = Math.max(dy, Math.abs(d.y));
      }
      const delta = L.point(dx, dy);
      const bounds = L.latLngBounds(map.unproject(origin.subtract(delta), 0), map.unproject(origin.add(delta), 0));
      map.setView(middle, map.getBoundsZoom(bounds, false, L.point(76, 76)), { animate:false });
      noticeKey = ''; redraw();
      noticeLayers.get(id)?.openPopup(middle);
    },
    go: (lat, lon) => map.setView([lat, lon], Math.max(4, map.getZoom())),
  };
}
