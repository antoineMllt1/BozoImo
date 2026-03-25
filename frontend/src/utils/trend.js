function quarterLabel(date) {
  const year = date.getFullYear();
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `T${quarter} ${year}`;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function toQuarterDate(date) {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
}

function linearRegression(points) {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (!denominator) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function buildQuarterlyTrend(features = [], currentEstimatePm2 = null) {
  const buckets = new Map();

  for (const feature of features) {
    const props = feature?.properties || {};
    if (!(props.area > 5 && props.updated_price > 0 && props.sale_at)) continue;
    const date = new Date(props.sale_at);
    if (Number.isNaN(date.getTime())) continue;
    const ppm2 = props.updated_price / props.area;
    const quarterDate = toQuarterDate(date);
    const key = quarterDate.toISOString();
    const existing = buckets.get(key) || { date: quarterDate, values: [] };
    existing.values.push(ppm2);
    buckets.set(key, existing);
  }

  const series = [...buckets.values()]
    .sort((a, b) => a.date - b.date)
    .map(entry => ({
      key: entry.date.toISOString(),
      date: entry.date,
      label: quarterLabel(entry.date),
      ppm2: Math.round(median(entry.values)),
      count: entry.values.length,
    }));

  const recent = series.slice(-8);
  const regression = linearRegression(recent.map((point, index) => ({ x: index, y: point.ppm2 })));
  const forecast = [];

  if (regression && recent.length >= 2) {
    const last = series[series.length - 1];
    for (let step = 1; step <= 4; step += 1) {
      const nextDate = new Date(last.date.getFullYear(), last.date.getMonth() + step * 3, 1);
      const ppm2 = Math.round(regression.intercept + regression.slope * (recent.length - 1 + step));
      forecast.push({
        key: `${nextDate.toISOString()}_forecast`,
        date: nextDate,
        label: quarterLabel(nextDate),
        ppm2,
        forecast: true,
      });
    }
  }

  return {
    series,
    forecast,
    currentEstimatePm2: currentEstimatePm2 ? Math.round(currentEstimatePm2) : null,
  };
}
