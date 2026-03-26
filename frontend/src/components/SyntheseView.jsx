import { fmtPm2, fmtPrice, fmtK } from '../utils/formatters';
import TrendChart from './TrendChart';
import RadarChart from './RadarChart';

function renderStars(stars = 0) {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
}

function DeltaBanner({ analystPm2, algoPm2 }) {
  if (!Number.isFinite(analystPm2) || !Number.isFinite(algoPm2) || algoPm2 === 0) return null;
  const delta = ((analystPm2 - algoPm2) / algoPm2) * 100;
  const cls = Math.abs(delta) <= 5 ? 'syn-delta-ok' : Math.abs(delta) <= 12 ? 'syn-delta-warn' : 'syn-delta-danger';
  return (
    <div className={`syn-delta-banner ${cls}`}>
      <span>Ecart analyste vs. algo</span>
      <strong>{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</strong>
      <small>
        {Math.abs(delta) <= 5 ? 'Convergence forte — estimation fiable'
          : Math.abs(delta) <= 12 ? 'Ecart modéré — vérifiez les hypothèses'
          : 'Ecart important — investigation recommandée'}
      </small>
    </div>
  );
}

export default function SyntheseView({
  dossier,
  mlEstimate,
  manualEstimate,
  metrics,
  areaScores,
  trend,
  filteredRefs,
}) {
  const target = dossier.target || {};
  const surfaceM2 = target.surfaceM2 || 0;
  const algoPm2 = mlEstimate?.correctedPm2 || null;
  const analystPm2 = manualEstimate || null;
  const algoPrice = algoPm2 && surfaceM2 ? Math.round(algoPm2 * surfaceM2) : null;
  const analystPrice = analystPm2 && surfaceM2 ? Math.round(analystPm2 * surfaceM2) : null;

  return (
    <div className="synthese-view">
      <DeltaBanner analystPm2={analystPm2} algoPm2={algoPm2} />

      <div className="syn-compare-row">
        <div className="syn-compare-card syn-card-analyst">
          <span className="syn-compare-kicker">Estimation Analyste</span>
          <strong className="syn-compare-pm2">{analystPm2 ? fmtPm2(analystPm2) : '—'}</strong>
          <span className="syn-compare-price">{analystPrice ? fmtPrice(analystPrice) : 'Non renseignée'}</span>
          <small>Basée sur votre expertise terrain</small>
        </div>

        <div className="syn-compare-vs">VS</div>

        <div className="syn-compare-card syn-card-algo">
          <span className="syn-compare-kicker">Estimation Algorithmique</span>
          <strong className="syn-compare-pm2">{algoPm2 ? fmtPm2(algoPm2) : '—'}</strong>
          <span className="syn-compare-price">{algoPrice ? fmtPrice(algoPrice) : 'Insuffisant'}</span>
          <div className="syn-compare-meta">
            {mlEstimate?.confidence && (
              <span>{renderStars(mlEstimate.confidence.stars)} {mlEstimate.confidence.label}</span>
            )}
            {mlEstimate && <span>{mlEstimate.nComps} comps</span>}
          </div>
        </div>
      </div>

      {metrics && (
        <div className="syn-kpi-row">
          <div className="syn-kpi">
            <span>Références retenues</span>
            <strong>{metrics.n}</strong>
          </div>
          <div className="syn-kpi">
            <span>DVF / SeLoger</span>
            <strong>{metrics.nDvf} / {metrics.nSl}</strong>
          </div>
          <div className="syn-kpi">
            <span>Moy. pondérée</span>
            <strong>{fmtPm2(metrics.avgWeighted)}</strong>
          </div>
          <div className="syn-kpi">
            <span>Ecart-type</span>
            <strong>{fmtPm2(metrics.stdDev)}</strong>
          </div>
          {mlEstimate?.confidence && (
            <div className="syn-kpi">
              <span>Confiance</span>
              <strong>{mlEstimate.confidence.score}/100</strong>
            </div>
          )}
        </div>
      )}

      <div className="syn-charts-row">
        <div className="syn-chart-col">
          <TrendChart trend={trend} />
        </div>
        <div className="syn-chart-col">
          <RadarChart scores={areaScores} />
        </div>
      </div>

      {dossier.confirmed && (
        <div className="syn-confirmed-banner">
          <span>Prix confirmé</span>
          <strong>{fmtK(dossier.confirmed.actualPrice)}</strong>
          <small>{fmtPm2(dossier.confirmed.actualPm2)} · confirmé le {new Date(dossier.confirmed.confirmedAt).toLocaleDateString('fr-FR')}</small>
        </div>
      )}
    </div>
  );
}
