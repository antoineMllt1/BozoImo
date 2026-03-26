import { fmtPrice } from '../utils/formatters';
import { InfoEmpty, InfoPanelShell, InfoStatGrid } from './InfoPanelShell';

function scoreLabel(score) {
  if (score >= 75) return 'forte';
  if (score >= 55) return 'reelle';
  if (score >= 40) return 'moderee';
  return 'faible';
}

export default function NegotiationDashboard({
  signals,
  score,
  argumentsList,
  offerRange,
  marketPosition,
  onRefreshCastorus,
  castorusLoading = false,
  hasCastorusSource = false,
}) {
  if (!signals.length && !offerRange && !marketPosition) {
    return (
      <InfoEmpty
        title="Negociation indisponible"
        body="Le moteur n'a pas encore assez de signaux pour produire une strategie exploitable."
      />
    );
  }

  return (
    <InfoPanelShell
      title="Negociation"
      subtitle="Agregation des signaux Castorus, DVF+, DPE et risques pour cadrer l'offre."
      actions={
        hasCastorusSource && onRefreshCastorus ? (
          <button className="topbar-btn" onClick={onRefreshCastorus} disabled={castorusLoading}>
            {castorusLoading ? 'Analyse...' : 'Actualiser Castorus'}
          </button>
        ) : null
      }
    >
      <div className="nego-hero">
        <div className="nego-score-ring">
          <strong>{score}</strong>
          <span>/100</span>
        </div>
        <div className="nego-hero-copy">
          <h4>Marge de nego {scoreLabel(score)}</h4>
          <p>
            {score >= 75
              ? 'Les signaux convergent vers une pression vendeuse elevee.'
              : score >= 55
                ? 'Le dossier presente plusieurs leviers credibles de baisse.'
                : score >= 40
                  ? 'Des arguments existent, mais la marge reste a documenter.'
                  : 'Peu de signaux faibles ou positifs pour pousser une baisse franche.'}
          </p>
        </div>
      </div>

      <InfoStatGrid
        items={[
          { label: 'Offre suggeree', value: offerRange ? fmtPrice(offerRange.suggestedOffer) : null },
          { label: 'Juste valeur', value: offerRange ? fmtPrice(offerRange.fairValue) : null },
          { label: 'Max recommande', value: offerRange ? fmtPrice(offerRange.maxRecommended) : null },
          { label: 'Balance', value: marketPosition?.buyerSellerBalance || null, note: marketPosition?.trend || '' },
        ]}
      />

      {signals.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Signaux retenus</strong>
          </div>
          <div className="signal-list">
            {signals.slice(0, 10).map((signal, index) => (
              <div key={`${signal.label}_${index}`} className={`signal-card signal-${signal.type}`}>
                <span>{signal.label}</span>
                <strong>{signal.impact > 0 ? `+${signal.impact}` : signal.impact}</strong>
                <p>{signal.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {argumentsList.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Arguments a verbaliser</strong>
          </div>
          <div className="info-grid-2">
            {argumentsList.slice(0, 8).map((item, index) => (
              <div key={`${item.title}_${index}`} className={`info-card arg-${item.strength}`}>
                <h4>{item.title}</h4>
                <p>{item.body}</p>
                <small>{item.source}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </InfoPanelShell>
  );
}
