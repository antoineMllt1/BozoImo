import { useEffect, useRef, useState } from 'react';
import { fmtPm2, fmtPrice, fmtK } from '../utils/formatters';
import TrendChart from './TrendChart';
import RadarChart from './RadarChart';

function renderStars(stars = 0) {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
}

function ConfirmPriceForm({ surfaceM2, onConfirm }) {
  const [price, setPrice] = useState('');
  const hasSurface = surfaceM2 > 0;

  const handleSubmit = () => {
    const parsed = parseFloat(price.replace(/[\s €]/g, '').replace(',', '.'));
    if (!parsed || parsed <= 0 || !hasSurface) return;
    onConfirm(parsed);
    setPrice('');
  };

  return (
    <section className="awb-card">
      <div className="awb-card-head">
        <div>
          <h3>Prix de vente réel</h3>
          <p>À renseigner une fois la transaction conclue — reste dans l'historique du dossier.</p>
        </div>
      </div>
      <div className="algo-confirm-form">
        <input
          type="number"
          min="10000"
          placeholder="Prix de vente réel"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <button className="topbar-btn topbar-btn-primary" disabled={!price || !hasSurface} onClick={handleSubmit}>
          Enregistrer
        </button>
      </div>
    </section>
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
  estimate,
  manualEstimate,
  metrics,
  areaScores,
  trend,
  filteredRefs,
  syntheseNotes,
  onConfirmPrice,
}) {
  const target = dossier.target || {};
  const surfaceM2 = target.surfaceM2 || 0;
  const marketPm2 = estimate?.estimatedPm2 || null;
  const finalPm2 = manualEstimate || marketPm2 || null;
  const finalPrice = finalPm2 && surfaceM2 ? Math.round(finalPm2 * surfaceM2) : null;

  const propertyContext = [
    `Adresse : ${dossier.address || 'Non renseignée'}`,
    `Type : ${target.type === 'House' ? 'Maison' : 'Appartement'} · ${surfaceM2} m² · ${target.rooms || '—'} pièces`,
    `Condition : ${target.condition || 'Non renseignée'} · DPE : ${target.dpe || 'Non renseigné'}`,
    `Prix retenu : ${finalPm2 ? `${Math.round(finalPm2).toLocaleString('fr-FR')} €/m²` : '—'}`,
    `Marché : ${metrics?.n ?? 0} refs · moy ${metrics?.avgWeighted ? Math.round(metrics.avgWeighted).toLocaleString('fr-FR') : '—'} €/m²`,
  ].join('\n');

  return (
    <div className="synthese-view">
      <div className="syn-compare-row">
        <div className="syn-compare-card syn-card-analyst">
          <span className="syn-compare-kicker">{manualEstimate ? 'Estimation retenue' : 'Estimation provisoire (repère marché)'}</span>
          <strong className="syn-compare-pm2">{finalPm2 ? fmtPm2(finalPm2) : '—'}</strong>
          <span className="syn-compare-price">{finalPrice ? fmtPrice(finalPrice) : 'Non renseignée'}</span>
          <small>
            {manualEstimate
              ? "Validée dans l'onglet Analyste"
              : "À valider dans l'onglet Analyste — repère basé sur les comparables"}
          </small>
          {estimate?.confidence && (
            <div className="syn-compare-meta">
              <span>{renderStars(estimate.confidence.stars)} {estimate.confidence.label}</span>
              <span>{estimate.nComps} comps</span>
            </div>
          )}
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
          {estimate?.confidence && (
            <div className="syn-kpi">
              <span>Confiance</span>
              <strong>{estimate.confidence.score}/100</strong>
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

      {dossier.confirmed ? (
        <div className="syn-confirmed-banner">
          <span>Prix confirmé</span>
          <strong>{fmtK(dossier.confirmed.actualPrice)}</strong>
          <small>{fmtPm2(dossier.confirmed.actualPm2)} · confirmé le {new Date(dossier.confirmed.confirmedAt).toLocaleDateString('fr-FR')}</small>
        </div>
      ) : onConfirmPrice && (
        <ConfirmPriceForm surfaceM2={surfaceM2} onConfirm={onConfirmPrice} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
