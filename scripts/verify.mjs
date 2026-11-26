import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DAY, position, geodetic, observer, passes } from "../web/orbit.js";
const data = JSON.parse(
  readFileSync(new URL("../web/data/latest.json", import.meta.url)),
);
const rows = data.orbit.data.rows;
assert.ok(rows.length > 100);
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  assert.ok(row.length === 7 && row.every(Number.isFinite));
  if (i) assert.ok(row[0] > rows[i - 1][0]);
}
const row = rows[Math.floor(rows.length / 2)];
assert.deepEqual(position(rows, row[0]), row.slice(1, 4));
assert.equal(position(rows, rows[0][0] - 1), null);
assert.equal(position(rows, rows.at(-1)[0] + 1), null);
const spacecraft = geodetic(row.slice(1, 4));
assert.ok(spacecraft.height > 250 && spacecraft.height < 600);
const directlyBelow = observer({ ...spacecraft, alt: 0 })(row.slice(1, 4));
assert.ok(directlyBelow.el > 89.99);
assert.ok(Math.abs(directlyBelow.range - spacecraft.height) < 0.001);
const site = { lat: 39.9, lon: 116.4, alt: 50, mask: 10 };
const list = passes(rows, site, rows[0][0], rows[0][0] + 2 * DAY);
assert.ok(list.length > 0);
for (const p of list) {
  assert.ok(p.start <= p.peak && p.peak <= p.end);
  assert.ok(p.el >= site.mask);
  if (!p.openStart)
    assert.ok(
      Math.abs(observer(site)(position(rows, p.start)).el - site.mask) < 0.2,
    );
  if (!p.openEnd)
    assert.ok(
      Math.abs(observer(site)(position(rows, p.end)).el - site.mask) < 0.2,
    );
}
assert.ok(
  Array.isArray(data.notices.data.items) && data.news.data.items.length,
);
console.log(
  "Verified ephemeris, geodetic conversion, pass predictions and source snapshots.",
);
