import { $, esc, anchor, date, dialog } from "./ui.js";
import { DAY, observer } from "./orbit.js";

function row(title, detail = "") {
  return (
    '<div class="row">' +
    title +
    (detail ? "<small>" + detail + "</small>" : "") +
    "</div>"
  );
}
const dayNumber = (v) => Date.parse(v + "T00:00:00+08:00");
const dayLabel = (v) => date(v, { month: "numeric", day: "numeric" });

export function createMission(go) {
  let snapshot,
    mission,
    visibleNotices = [],
    lastMission = "",
    lastFeed = null;
  function returnState(t) {
    const headlines = (snapshot.news.data?.items || []).filter(
      (i) =>
        dayNumber(i.date) + DAY <= t ||
        (t >= Date.now() - 3000 && dayNumber(i.date) <= t),
    );
    const named = headlines.filter((i) => i.title.includes("神舟二十三号"));
    if (
      named.some((i) =>
        /返回舱.*(?:成功着陆|顺利着陆)|返回舱.*着陆.*圆满成功/.test(i.title),
      )
    )
      return "已着陆";
    if (named.some((i) => /飞船(?:已|顺利|成功)?撤离空间站/.test(i.title)))
      return "返回飞行中";
    if (t < Date.parse(mission.events[2].at)) return "在轨任务";
    return "返回准备";
  }
  function drawMission(t) {
    const phase = returnState(t);
    $("returnStage").textContent = phase;
    const d = mission.history.map(
      (x) => (dayNumber(x.landing) - dayNumber(x.arrival)) / DAY,
    );
    const earliest = dayNumber(mission.arrival) + Math.min(...d) * DAY,
      latest = dayNumber(mission.arrival) + Math.max(...d) * DAY;
    const official = mission.officialReturn;
    const scheduled = (snapshot.news.data?.items || []).find(
      (n) =>
        dayNumber(n.date) <= t &&
        /神舟二十三号.*将于.{0,12}\d+月\d+日.{0,12}(?:回家|返回|着陆)/.test(
          n.title,
        ),
    );
    let window = "待公布",
      basis = "等待官方返回安排";
    if (phase === "已着陆") {
      window = "任务已完成";
      basis = "官方任务动态已更新";
    } else if (official && Date.parse(official.published) <= t) {
      window = official.label;
      basis = anchor(official.url, "官方返回安排");
    } else if (scheduled) {
      window = (scheduled.title.match(/\d+月\d+日/) || ["待公布"])[0];
      basis = anchor(scheduled.url, "官方任务公告");
    } else if (phase === "返回准备" && d.length && t < latest + DAY) {
      window = dayLabel(earliest) + " – " + dayLabel(latest);
      basis =
        "历史轮换类比 · " + d.length + " 次样本 · 本次含短期访问，日期待官宣";
    } else if (phase === "返回准备") {
      window = "待更新";
      basis = "历史参考窗口已过，等待官方安排";
    }
    $("window").textContent = window;
    $("basis").innerHTML = basis;
    $("crew").innerHTML = [
      ["着陆场", mission.landing],
      ["返回乘员", mission.crewReturn.join("、")],
      ["留轨乘员", mission.crewStay.join("、")],
    ]
      .map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + esc(v) + "</dd></div>")
      .join("");
    $("events").innerHTML =
      mission.events
        .filter((e) => Date.parse(e.at) <= t)
        .reverse()
        .map(
          (e) =>
            "<li><small>" +
            date(e.at) +
            "</small>" +
            anchor(e.url, e.title) +
            "</li>",
        )
        .join("") || "<small>暂无事件</small>";
  }
  function set(data, curated) {
    snapshot = data;
    mission = curated;
    lastMission = "";
    lastFeed = null;
    $("historyBtn").onclick = () =>
      dialog(
        "返回日期 · 历史样本",
        "<p>按北京时间比较新乘组进驻日至上一飞船着陆日，取样本最短至最长间隔。</p>" +
          mission.history
            .map((h) =>
              row(
                esc(h.name) +
                  " · " +
                  Math.round(
                    (dayNumber(h.landing) - dayNumber(h.arrival)) / DAY,
                  ) +
                  " 天",
                anchor(h.arrivalSource, h.arrival + " 进驻") +
                  " → " +
                  anchor(h.landingSource, h.landing + " 着陆"),
              ),
            )
            .join(""),
      );
    $("newsBtn").onclick = () =>
      dialog(
        "官方任务动态",
        (snapshot.news.data?.items || [])
          .map((x) => row(anchor(x.url, x.title), esc(x.date)))
          .join("") || "暂无公告",
      );
    $("noticesBtn").onclick = () =>
      dialog(
        "所选时刻生效的通告",
        visibleNotices
          .map((n) => row(esc(n.code), esc(n.time) + " UTC<br>" + esc(n.text)))
          .join("") || "无已知有效通告",
      );
    const links = {
      orbit: ["空间站官方星历", "https://www.cmse.gov.cn/gfgg/zgkjzgdcs/"],
      news: ["载人航天任务公告", "https://www.cmse.gov.cn/fxrw/SZ24/"],
      notices: ["Joey0609 / NOTAM", "https://joey0609.github.io/notams/"],
    };
    $("sourceList").innerHTML =
      Object.entries(links)
        .map(([k, [title, url]]) => {
          const entry = snapshot[k],
            orbit = entry.data?.rows;
          let info = entry.success
            ? "上次成功 " + date(entry.success)
            : "尚无快照";
          if (k === "orbit" && orbit?.length)
            info +=
              "<br>覆盖 " + date(orbit[0][0]) + " 至 " + date(orbit.at(-1)[0]);
          if (entry.error) info += "<br>更新失败 · " + esc(entry.error);
          return row(anchor(url, title), info);
        })
        .join("");
    $("syncStamp").textContent = "快照 " + date(snapshot.updated);
  }
  function render(t, p) {
    const key = [Math.floor(t / 60000), returnState(t)].join();
    if (lastMission !== key) {
      lastMission = key;
      drawMission(t);
    }
    const items = snapshot.notices.data?.items || [];
    visibleNotices = items.filter(
      (n) =>
        n.period?.length === 2 &&
        n.period.every(Number.isFinite) &&
        n.period[0] <= t &&
        t < n.period[1],
    );
    $("noticeCount").textContent = visibleNotices.length + " 条生效";
    const partial = snapshot.notices.data?.partial;
    $("noticeHint").textContent =
      "按选定时间筛选 · 任务关联待核实" +
      (partial?.length ? " · 缺源 " + partial.join(", ").toUpperCase() : "");
    const contacts = mission.contacts.filter(
      (c) => Date.parse(c.start) <= t && t < Date.parse(c.end) && c.url,
    );
    const states = mission.stations.map(s => {
      const located = Boolean(s.coordinateSource) && Number.isFinite(s.lat) && Math.abs(s.lat) <= 90 && Number.isFinite(s.lon) && Math.abs(s.lon) <= 180;
      return { s, located, isUp: Boolean(located && p && observer(s)(p).el >= (s.mask ?? 0)),
        confirmed: contacts.find(c => c.station === s.id) };
    });
    const feedKey = JSON.stringify([
      p !== null,
      states.map((x) => [x.isUp, x.confirmed]),
      mission.stations,
    ]);
    if (lastFeed !== feedKey) {
      lastFeed = feedKey;
      $("stations").innerHTML = states
        .map(
          ({ s, located, isUp, confirmed }) =>
            '<div class="station line"><div><b>' + esc(s.name) + '</b><small>' +
            anchor(s.source, s.episode) + '</small><small>' +
            (located ? (p ? (isUp ? "几何可见" : "低于仰角门限") : "无星历") : "站址未核实") +
            (confirmed ? " · " + anchor(confirmed.url, "通信已报告") : "") + '</small></div>' +
            (located ? '<button data-station="' + esc(s.id) + '">定位</button>' : '') + '</div>',
        )
        .join("");
      $("stations")
        .querySelectorAll("button")
        .forEach(
          (b) =>
            (b.onclick = () => {
              const s = mission.stations.find(
                (s) => s.id === b.dataset.station,
              );
              go(s.lat, s.lon);
            }),
        );
    }
    return { notices: visibleNotices, stationStates: states };
  }
  return { set, render };
}
