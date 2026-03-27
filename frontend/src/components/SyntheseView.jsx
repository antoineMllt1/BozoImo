import { useEffect, useRef, useState } from 'react';
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

async function callClaudeApi(syntheseNotes, propertyContext) {
  const response = await fetch('/api/claude/improve-synthesis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analystNotes: syntheseNotes, propertyContext }),
  });
  if (!response.ok) throw new Error('Erreur API Claude');
  const data = await response.json();
  return data.synthesis || '';
}

function renderInline(text) {
  // Convert **bold** to <strong>
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

function MarkdownRenderer({ text }) {
  const elements = [];
  let bulletGroup = [];

  const flushBullets = () => {
    if (bulletGroup.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} style={{ margin: '8px 0 10px 0', paddingLeft: 0, listStyle: 'none' }}>
        {bulletGroup.map((b, i) => (
          <li key={i} style={{ display: 'flex', gap: '8px', marginBottom: '5px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>•</span>
            <span>{renderInline(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletGroup = [];
  };

  for (const line of text.split('\n')) {
    const t = line.trim();
    // Skip empty lines, separators, and lines that are only dashes
    if (!t || /^-{2,}$/.test(t)) continue;

    // Section headers (# / ##) — render as small label
    if (t.startsWith('#')) {
      flushBullets();
      const heading = t.replace(/^#+\s*/, '');
      if (heading) {
        elements.push(
          <div key={`h-${elements.length}`} style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#2563eb',
            margin: elements.length === 0 ? '0 0 6px 0' : '12px 0 6px 0',
          }}>
            {heading}
          </div>
        );
      }
      continue;
    }

    // Bullet lines
    if (/^[•\-*–]/.test(t)) {
      const content = t.replace(/^[•\-*–]\s*/, '').trim();
      if (content && !/^-+$/.test(content)) bulletGroup.push(content);
      continue;
    }

    flushBullets();
    elements.push(
      <p key={`p-${elements.length}`} style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.65', color: '#374151' }}>
        {renderInline(t)}
      </p>
    );
  }

  flushBullets();
  return <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#374151' }}>{elements}</div>;
}

function AiSynthesisPreview({ syntheseNotes, propertyContext }) {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [result, setResult] = useState('');
  const prevNotes = useRef('');

  useEffect(() => {
    if (!syntheseNotes?.trim()) {
      setStatus('idle');
      setResult('');
      return;
    }
    // Debounce — only call after user stops typing for 1.5s
    const timer = setTimeout(async () => {
      if (syntheseNotes === prevNotes.current) return;
      prevNotes.current = syntheseNotes;
      setStatus('loading');
      try {
        const text = await callClaudeApi(syntheseNotes, propertyContext);
        setResult(text);
        setStatus('done');
      } catch {
        setStatus('error');
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [syntheseNotes, propertyContext]);

  if (!syntheseNotes?.trim()) {
    return (
      <div style={{ padding: '16px', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
        Saisissez vos notes dans l'onglet Analyste — l'IA enrichira la synthèse ici automatiquement.
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#6b7280', fontSize: '13px' }}>
        <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Génération de la synthèse en cours...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '6px', color: '#92400e', fontSize: '12px' }}>
        ⚠ Erreur lors de la génération IA. Vérifiez que le backend est lancé. La synthèse brute sera utilisée dans le PDF.
      </div>
    );
  }

  if (status === 'done' && result) {
    return <MarkdownRenderer text={result} />;
  }

  return null;
}

export default function SyntheseView({
  dossier,
  mlEstimate,
  manualEstimate,
  metrics,
  areaScores,
  trend,
  filteredRefs,
  syntheseNotes,
}) {
  const target = dossier.target || {};
  const surfaceM2 = target.surfaceM2 || 0;
  const algoPm2 = mlEstimate?.correctedPm2 || null;
  const analystPm2 = manualEstimate || null;
  const algoPrice = algoPm2 && surfaceM2 ? Math.round(algoPm2 * surfaceM2) : null;
  const analystPrice = analystPm2 && surfaceM2 ? Math.round(analystPm2 * surfaceM2) : null;

  const propertyContext = [
    `Adresse : ${dossier.address || 'Non renseignée'}`,
    `Type : ${target.type === 'House' ? 'Maison' : 'Appartement'} · ${surfaceM2} m² · ${target.rooms || '—'} pièces`,
    `Condition : ${target.condition || 'Non renseignée'} · DPE : ${target.dpe || 'Non renseigné'}`,
    `Prix analyste : ${analystPm2 ? `${Math.round(analystPm2).toLocaleString('fr-FR')} €/m²` : '—'}`,
    `Prix algo : ${algoPm2 ? `${Math.round(algoPm2).toLocaleString('fr-FR')} €/m²` : '—'}`,
    `Marché : ${metrics?.n ?? 0} refs · moy ${metrics?.avgWeighted ? Math.round(metrics.avgWeighted).toLocaleString('fr-FR') : '—'} €/m²`,
  ].join('\n');

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

      {/* IA Synthesis Preview */}
      <section className="awb-card" style={{ marginTop: '16px' }}>
        <div className="awb-card-head" style={{ marginBottom: '12px' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Synthèse enrichie par l'IA
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                background: '#dbeafe',
                color: '#1d4ed8',
                padding: '2px 7px',
                borderRadius: '999px',
                letterSpacing: '0.03em',
              }}>APERÇU PDF</span>
            </h3>
            <p>Mise à jour automatique dès que vous modifiez vos notes dans l'onglet Analyste.</p>
          </div>
        </div>
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '14px 16px',
          minHeight: '80px',
        }}>
          <AiSynthesisPreview syntheseNotes={syntheseNotes} propertyContext={propertyContext} />
        </div>
        {syntheseNotes?.trim() && (
          <details style={{ marginTop: '10px' }}>
            <summary style={{ fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>Voir mes notes brutes</summary>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '6px 0 0 0', fontStyle: 'italic' }}>{syntheseNotes}</p>
          </details>
        )}
      </section>

      {dossier.confirmed && (
        <div className="syn-confirmed-banner">
          <span>Prix confirmé</span>
          <strong>{fmtK(dossier.confirmed.actualPrice)}</strong>
          <small>{fmtPm2(dossier.confirmed.actualPm2)} · confirmé le {new Date(dossier.confirmed.confirmedAt).toLocaleDateString('fr-FR')}</small>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
