// Display reference only: circle center or area-weighted centroid in a local
// longitude/latitude plane. Unwrap longitudes before crossing the date line.
export function areaCenter({circle, points}) {
  const valid = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
  if (circle) return valid(circle[0]) && Number.isFinite(circle[1]) && circle[1] > 0 ? [...circle[0]] : null;
  if (!Array.isArray(points) || points.length < 3 || !points.every(valid)) return null;
  const [lat0, lon0] = points[0]; let previous = lon0;
  const vertices = points.map(([lat, lon]) => {
    previous = lon + 360 * Math.round((previous - lon) / 360);
    return [previous - lon0, lat - lat0];
  });
  let twiceArea = 0, x = 0, y = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const cross = a[0] * b[1] - b[0] * a[1];
    twiceArea += cross; x += (a[0] + b[0]) * cross; y += (a[1] + b[1]) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) return null;
  return [lat0 + y / (3 * twiceArea), ((lon0 + x / (3 * twiceArea) + 540) % 360) - 180];
}
