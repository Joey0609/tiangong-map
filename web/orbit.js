const RAD = Math.PI / 180;
const A = 6378.137;
const E2 = 6.69437999014e-3;
export const DAY = 86400000;

export function position(rows, time) {
  if (!rows?.length || time < rows[0][0] || time > rows.at(-1)[0]) return null;
  let low = 0, high = rows.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (rows[mid][0] <= time) low = mid; else high = mid;
  }
  const a = rows[low], b = rows[high], span = b[0] - a[0];
  if (span > 600000 || span <= 0) return null;
  const t = (time - a[0]) / span, s = 1 - t, dt = span / 1000;
  return [1, 2, 3].map(i => (1+2*t)*s*s*a[i] + t*s*s*dt*a[i+3]
    + t*t*(3-2*t)*b[i] - t*t*s*dt*b[i+3]);
}

export function geodetic([x,y,z]) {
  const r = Math.hypot(x,y);
  let lat = Math.atan2(z,r*(1-E2));
  for (let i=0;i<5;i++) {
    const sin = Math.sin(lat);
    lat = Math.atan2(z + E2*A*sin/Math.sqrt(1-E2*sin*sin),r);
  }
  const sin = Math.sin(lat);
  return {lat:lat/RAD, lon:Math.atan2(y,x)/RAD,
    height:r*Math.cos(lat)+z*sin-A*Math.sqrt(1-E2*sin*sin)};
}

export function observer(site) {
  const p = site.lat*RAD, l = site.lon*RAD;
  const sp = Math.sin(p), cp = Math.cos(p), sl = Math.sin(l), cl = Math.cos(l);
  const n = A/Math.sqrt(1-E2*sp*sp), h = (site.alt || 0)/1000;
  const base = [(n+h)*cp*cl,(n+h)*cp*sl,(n*(1-E2)+h)*sp];
  return target => {
    const [x,y,z] = target.map((v,i)=>v-base[i]);
    const east = -sl*x+cl*y, north = -sp*cl*x-sp*sl*y+cp*z;
    return {az:(Math.atan2(east,north)/RAD+360)%360,
      el:Math.atan2(cp*cl*x+cp*sl*y+sp*z,Math.hypot(east,north))/RAD, range:Math.hypot(x,y,z)};
  };
}

// Search local maxima, then refine both threshold crossings to one second.
export function passes(rows, site, from, until) {
  if (!rows?.length) return [];
  const start=Math.max(from,rows[0][0]), end=Math.min(until,rows.at(-1)[0]);
  if(start>=end) return [];
  const look=observer(site), step=45000, limit=site.mask;
  function elevation(t){const p=position(rows,t);return p?look(p).el:-90;}
  function crossing(below,above){
    while(Math.abs(above-below)>1000){
      const m=(above+below)/2;
      if(elevation(m)>=limit) above=m; else below=m;
    }
    return Math.round(above);
  }
  const result=[];
  function add(peak){
    if(elevation(peak)<limit || (result.length && peak<=result.at(-1).end))return;
    let a=peak,b=peak;
    while(a>start && elevation(a)>=limit)a=Math.max(start,a-step);
    while(b<end && elevation(b)>=limit)b=Math.min(end,b+step);
    const openStart=a===start && elevation(a)>=limit;
    const openEnd=b===end && elevation(b)>=limit;
    result.push({start:openStart?a:crossing(a,peak),end:openEnd?b:crossing(b,peak),
      peak,el:elevation(peak),openStart,openEnd});
  }
  let a=start,b=Math.min(start+step,end),ea=elevation(a),eb=elevation(b);
  if(ea>=eb)add(start);
  while(b<end){
    const c=Math.min(b+step,end),ec=elevation(c);
    if(eb>=ea && eb>=ec){
      let l=a,r=c;
      while(r-l>1000){
        const d=(r-l)/3;
        if(elevation(l+d)<elevation(r-d))l+=d;else r-=d;
      }
      add((l+r)/2);
    }
    a=b;b=c;ea=eb;eb=ec;
  }
  if(eb>=ea)add(end);
  return result;
}

