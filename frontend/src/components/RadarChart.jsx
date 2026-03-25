function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function premiumToScore(neighborhoodPremium) {
  const factor = neighborhoodPremium?.factor;
  if (!Number.isFinite(factor)) return null;
  return Math.max(0, Math.min(100, Math.round(((factor - 0.95) / 0.1) * 100)));
}

export default function RadarChart({ scores = {} }) {
  const axes = [
    { key: 'transportScore', label: 'Transport', value: scores.transportScore },
    { key: 'walkScore', label: 'Walk', value: scores.walkScore },
    { key: 'educationScore', label: 'Ecoles', value: scores.educationScore },
    { key: 'environmentScore', label: 'Env.', value: scores.environmentScore },
    { key: 'premium', label: 'Prime', value: premiumToScore(scores.neighborhoodPremium) },
  ].filter(axis => Number.isFinite(axis.value));

  if (axes.length < 3) {
    return (
      <div className="viz-card radar-card">
        <div className="viz-card-header">
          <div>
            <h3>Profil quartier</h3>
            <p>Contexte insuffisant pour construire un radar interpretable.</p>
          </div>
        </div>
      </div>
    );
  }

  const size = 300;
  const center = size / 2;
  const radius = 98;
  const levels = [25, 50, 75, 100];
  const angleStep = 360 / axes.length;

  const polygonPoints = axes.map((axis, index) => {
    const point = polarToCartesian(center, center, (radius * axis.value) / 100, angleStep * index);
    return `${point.x},${point.y}`;
  }).join(' ');

  return (
    <div className="viz-card radar-card">
      <div className="viz-card-header">
        <div>
          <h3>Profil quartier</h3>
          <p>Lecture composite des transports, amenites, ecoles, environnement et prime de quartier.</p>
        </div>
      </div>

      <div className="radar-wrap">
        <svg viewBox={`0 0 ${size} ${size}`} className="radar-chart" role="img" aria-label="Radar des scores de quartier">
          {levels.map(level => (
            <polygon
              key={level}
              points={axes.map((_, index) => {
                const point = polarToCartesian(center, center, (radius * level) / 100, angleStep * index);
                return `${point.x},${point.y}`;
              }).join(' ')}
              className="radar-grid"
            />
          ))}

          {axes.map((axis, index) => {
            const linePoint = polarToCartesian(center, center, radius, angleStep * index);
            const labelPoint = polarToCartesian(center, center, radius + 22, angleStep * index);
            return (
              <g key={axis.key}>
                <line x1={center} y1={center} x2={linePoint.x} y2={linePoint.y} className="radar-axis" />
                <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" className="radar-label">
                  {axis.label}
                </text>
                <text x={linePoint.x} y={linePoint.y} textAnchor="middle" className="radar-value">
                  {axis.value}
                </text>
              </g>
            );
          })}

          <polygon points={polygonPoints} className="radar-shape" />
          {axes.map((axis, index) => {
            const point = polarToCartesian(center, center, (radius * axis.value) / 100, angleStep * index);
            return <circle key={`${axis.key}_point`} cx={point.x} cy={point.y} r="4.5" className="radar-point" />;
          })}
        </svg>

        <div className="radar-legend">
          {axes.map(axis => (
            <div key={axis.key} className="radar-legend-row">
              <span>{axis.label}</span>
              <strong>{axis.value}/100</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
