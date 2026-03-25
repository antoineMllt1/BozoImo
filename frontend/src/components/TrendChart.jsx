function buildPath(points) {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function computeDeltaPercent(series) {
  if (!series || series.length < 2) return null;
  const first = series[0]?.ppm2;
  const last = series[series.length - 1]?.ppm2;
  if (!Number.isFinite(first) || !Number.isFinite(last) || !first) return null;
  return ((last - first) / first) * 100;
}

export default function TrendChart({ trend, compact = false }) {
  const series = trend?.series || [];
  const forecast = trend?.forecast || [];

  if (!series.length) {
    return compact ? null : (
      <div className="viz-card trend-card">
        <div className="viz-card-header">
          <div>
            <h3>Evolution trimestrielle</h3>
            <p>Pas assez de transactions DVF pour tracer une tendance fiable.</p>
          </div>
        </div>
      </div>
    );
  }

  const width = compact ? 168 : 640;
  const height = compact ? 54 : 260;
  const paddingX = compact ? 4 : 28;
  const paddingY = compact ? 5 : 24;
  const actualCount = series.length;
  const totalCount = series.length + forecast.length;
  const values = [
    ...series.map(point => point.ppm2),
    ...forecast.map(point => point.ppm2),
    trend?.currentEstimatePm2,
  ].filter(Number.isFinite);

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);
  const stepX = totalCount > 1 ? (width - paddingX * 2) / (totalCount - 1) : 0;

  const toCoord = (value, index) => ({
    x: paddingX + index * stepX,
    y: paddingY + ((maxValue - value) / range) * (height - paddingY * 2),
  });

  const actualCoords = series.map((point, index) => ({ ...point, ...toCoord(point.ppm2, index) }));
  const forecastCoords = forecast.map((point, index) => ({
    ...point,
    ...toCoord(point.ppm2, actualCount - 1 + index + 1),
  }));

  const forecastPath = forecastCoords.length
    ? buildPath([actualCoords[actualCoords.length - 1], ...forecastCoords])
    : '';
  const currentEstimateY = Number.isFinite(trend?.currentEstimatePm2)
    ? paddingY + ((maxValue - trend.currentEstimatePm2) / range) * (height - paddingY * 2)
    : null;
  const deltaPct = computeDeltaPercent(series);

  if (compact) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-sparkline" aria-hidden="true">
        <path d={buildPath(actualCoords)} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" />
        {forecastPath && (
          <path
            d={forecastPath}
            fill="none"
            stroke="#0f172a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="5 4"
            opacity="0.65"
          />
        )}
      </svg>
    );
  }

  return (
    <div className="viz-card trend-card">
      <div className="viz-card-header">
        <div>
          <h3>Evolution trimestrielle</h3>
          <p>Medianes DVF par trimestre avec projection simple sur les 4 prochains trimestres.</p>
        </div>
        <div className="viz-card-meta">
          <span>{series[0].label}</span>
          <strong>{series[series.length - 1].label}</strong>
          {deltaPct != null && (
            <span className={deltaPct >= 0 ? 'viz-up' : 'viz-down'}>
              {deltaPct >= 0 ? '+' : ''}
              {deltaPct.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" role="img" aria-label="Courbe de tendance DVF">
        {[0, 1, 2, 3].map(step => {
          const y = paddingY + ((height - paddingY * 2) / 3) * step;
          const value = Math.round(maxValue - (range / 3) * step);
          return (
            <g key={step}>
              <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} className="trend-grid-line" />
              <text x={4} y={y + 4} className="trend-axis-label">{value.toLocaleString('fr-FR')}</text>
            </g>
          );
        })}

        {currentEstimateY != null && (
          <>
            <line
              x1={paddingX}
              y1={currentEstimateY}
              x2={width - paddingX}
              y2={currentEstimateY}
              className="trend-current-line"
            />
            <text x={width - paddingX} y={currentEstimateY - 6} textAnchor="end" className="trend-current-label">
              Estimation actuelle
            </text>
          </>
        )}

        <path d={buildPath(actualCoords)} fill="none" stroke="#0f766e" strokeWidth="3.5" strokeLinecap="round" />
        {forecastPath && (
          <path
            d={forecastPath}
            fill="none"
            stroke="#0f172a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="8 6"
            opacity="0.6"
          />
        )}

        {actualCoords.map(point => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="4.5" className="trend-point" />
            <text x={point.x} y={height - 6} textAnchor="middle" className="trend-quarter-label">
              {point.label}
            </text>
          </g>
        ))}

        {forecastCoords.map(point => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="4" className="trend-point trend-point-forecast" />
            <text x={point.x} y={height - 6} textAnchor="middle" className="trend-quarter-label">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
