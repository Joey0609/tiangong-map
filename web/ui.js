export const $ = (id) => document.getElementById(id);
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icon = name => `<svg class="icon" aria-hidden="true" focusable="false"><use href="vendor/lucide.svg#${name}"></use></svg>`;
export function anchor(url, title) {
  try {
    if (new URL(url).protocol !== "https:") return esc(title);
  } catch {
    return esc(title);
  }
  return (
    '<a target="_blank" rel="noopener" href="' +
    esc(url) +
    '">' +
    esc(title) + " " + icon("arrow-up-right") +
    "</a>"
  );
}
export const date = (
  v,
  options = {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  },
) =>
  new Intl.DateTimeFormat("zh-CN", {
    ...options,
    timeZone: "Asia/Shanghai",
    hourCycle: "h23",
  }).format(new Date(v));
export const hm = (t) => date(t, { hour: "2-digit", minute: "2-digit" });
export const angle = (v, lat) =>
  Math.abs(v).toFixed(2) +
  "°" +
  (lat ? (v < 0 ? "S" : "N") : v < 0 ? "W" : "E");
export function dialog(title, html) {
  $("detailTitle").textContent = title;
  $("detailBody").innerHTML = html;
  $("details").showModal();
}
let toastTimer;
export function toast(msg) {
  $("status").textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("status").textContent = ""), 4500);
}
export function navigation() {
  const names = {
    observer: "固定观测点",
    mission: "任务进展",
    layers: "地图图层",
    sources: "数据来源",
  };
  function fold() {
    $("drawer").classList.add("folded");
    document.querySelectorAll(".rail button").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-expanded", "false");
    });
  }
  for (const b of document.querySelectorAll(".rail button")) {
    b.onclick = () => {
      if (
        b.classList.contains("active") &&
        !$("drawer").classList.contains("folded")
      )
        return fold();
      document
        .querySelectorAll(".view")
        .forEach((v) => (v.hidden = v.id !== b.dataset.view));
      document.querySelectorAll(".rail button").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-expanded", String(x === b));
      });
      $("drawerTitle").textContent = names[b.dataset.view];
      $("drawer").classList.remove("folded");
    };
  }
  $("hideDrawer").onclick = fold;
  if (matchMedia("(max-width:700px)").matches) fold();
  document.querySelectorAll("dialog").forEach((d) => {
    d.querySelector(".close").onclick = () => d.close();
    d.addEventListener("click", (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    });
  });
}
