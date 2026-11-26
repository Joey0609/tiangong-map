// Historical intervals use timezone-qualified timestamps; no station ephemeris or NOTAM input.
const absoluteTime = value => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
export function durationMinutes(sample) {
  const elapsed = absoluteTime(sample.touchdown) - absoluteTime(sample.separation);
  return Number.isFinite(elapsed) && elapsed > 0 ? elapsed / 60000 : null;
}
export function landingRange(separation, samples, asOf) {
  if (!separation?.url?.startsWith('https://')) return null;
  const start = absoluteTime(separation.at), published = absoluteTime(separation.published);
  if (![start, published, asOf].every(Number.isFinite) || Math.max(start, published) > asOf) return null;
  const durations = samples.map(durationMinutes).filter(Number.isFinite);
  if (!durations.length) return null;
  const from = start + Math.min(...durations) * 60000, to = start + Math.max(...durations) * 60000;
  return asOf <= to ? {from, to, count:durations.length} : null;
}
