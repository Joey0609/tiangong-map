import { date, esc, icon, toast } from './ui.js';

export const noticeId = n => `${n.source}:${n.id}:${n.code}`;
export function returnLabel(n) {
  const text = String(n.text || '');
  if (/\bNOTAMC\b/.test(text.split(/\r|\n/)[0])) return '';
  if (!/\bre[ -]?entry\b|\breenter(?:ing)?\b|返回舱|再入(?:大气层|活动|区域)|飞船返回/i.test(text)) return '';
  const mission = text.match(/神舟[零〇一二三四五六七八九十百\d]+号|\bSHENZHOU[ -]?\d+\b/i);
  return mission ? `${mission[0]}返回航警` : /\bSPACE\s?X\b/i.test(text) ? 'SpaceX 再入航警' : '再入航警';
}
export function coordinateText(n) {
  const point = ([lat, lon]) => `${Math.abs(lat).toFixed(5)}°${lat < 0 ? 'S' : 'N'}，${Math.abs(lon).toFixed(5)}°${lon < 0 ? 'W' : 'E'}`;
  if (n.circle) return `${point(n.circle[0])} · 半径 ${n.circle[1]} m`;
  return (n.points || []).map(point).join('\n');
}
const button = (action, title, glyph) => `<button type="button" data-action="${action}" aria-label="${title}" title="${title}">${icon(glyph)}</button>`;
export function bindNotice(layer, n, hide) {
  const label = returnLabel(n), coord = coordinateText(n), raw = String(n.text || ''), text = raw.replace(/\r/g, '').trim();
  const fir = text.match(/(?:^|\n)A\)\s*([A-Z]{4})\b/)?.[1] || '—';
  const detail = text.match(/(?:^|\n)E\)\s*([\s\S]*?)(?=\n\s*[FG]\)|\nCREATED:|$)/)?.[1]?.trim() || text;
  const type = n.source || 'NOTAM';
  layer.bindPopup(() => {
    const box = document.createElement('section'); box.className = 'advisory';
    const period = n.period?.length === 2 && n.period.every(Number.isFinite) ? n.period.map(v => date(v, {year:'numeric', month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})).join(' – ') + ' 北京时间 (UTC+8)' : n.time;
    box.innerHTML = `<div class="advisory-head"><b>${esc(type)} 信息</b>${button('raw','查看航警原文','file-text')}${button('hide','隐藏航警','eye-off')}${button('pin','固定弹窗','pin')}${button('copy','复制原始报文','copy')}${button('close','关闭','x')}</div><div class="advisory-body"><div data-structured>${label ? `<strong>${esc(label)}</strong>` : ''}<small>持续时间</small>${esc(period)}<div class="advisory-cols"><div><small>航警编号</small>${esc(n.code)}</div><div><small>飞行情报区</small>${esc(fir)}</div></div><small>航警详情</small><pre>${esc(detail)}</pre>${coord ? `<details><summary>边界坐标</summary><pre>${esc(coord)}</pre></details>` : ''}</div><pre data-original hidden>${esc(text)}</pre></div>`;
    const popup = layer.getPopup();
    box.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const action = b.dataset.action;
      if (action === 'raw') { const r = box.querySelector('[data-original]'); r.hidden = !r.hidden; box.querySelector('[data-structured]').hidden = !r.hidden; b.setAttribute('aria-pressed',String(!r.hidden)); }
      if (action === 'copy') { try { await navigator.clipboard.writeText(raw); toast('已复制原始报文'); } catch { toast('复制失败，可在原文视图中选择文本'); } }
      if (action === 'pin') { const pin = popup.options.autoClose !== false; popup.options.autoClose = !pin; popup.options.closeOnClick = !pin; const map = popup._map; map.off("preclick", popup.close, popup); if (!pin) map.on("preclick", popup.close, popup); b.setAttribute('aria-pressed',String(pin)); }
      if (action === 'hide') { if (b.dataset.confirm) hide(); else { b.dataset.confirm='1'; b.textContent='确认'; b.setAttribute('aria-label','确认隐藏航警'); } }
      if (action === 'close') layer.closePopup();
    };
    return box;
  }, { className:'notam-info-popup', maxWidth:300, minWidth:235, closeButton:false });
  layer.on('popupclose', () => { Object.assign(layer.getPopup().options,{autoClose:true,closeOnClick:true}); });
}
