import { computeRiskScore, formatRiskSummary, riskImpactOnValue, riskScoreColor, riskScoreLabel } from '../utils/risks';
import { InfoEmpty, InfoPanelShell, InfoStatGrid } from './InfoPanelShell';

function extractRiskLabel(item) {
  return item?.libelle_risque_jo || item?.type || item?.libelle || 'Risque';
}

export default function RiskPanel({ riskProfile }) {
  if (!riskProfile) {
    return (
      <InfoEmpty
        title="Risques indisponibles"
        body="Aucun profil Georisques n'a ete collecte pour ce dossier."
      />
    );
  }

  const score = computeRiskScore(riskProfile);
  const impact = riskImpactOnValue(riskProfile);

  return (
    <InfoPanelShell
      title="Georisques"
      subtitle="Risques naturels, pollution, radon et historique catnat autour du bien."
    >
      <div className="risk-hero">
        <div className="risk-score-badge" style={{ borderColor: riskScoreColor(score), color: riskScoreColor(score) }}>
          <strong>{score ?? '—'}</strong>
          <span>{riskScoreLabel(score)}</span>
        </div>
        <p>{formatRiskSummary(riskProfile)}</p>
      </div>

      <InfoStatGrid
        items={[
          { label: 'Decote theorique', value: `${impact.impactPct}%` },
          { label: 'Risques GASPAR', value: riskProfile.risques?.length || 0 },
          { label: 'Sites pollues', value: riskProfile.sitesPollues?.length || 0 },
          { label: 'Catnat', value: riskProfile.catastrophesNaturelles?.length || 0 },
        ]}
      />

      {impact.details?.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Impacts majeurs sur la valeur</strong>
          </div>
          <div className="signal-list">
            {impact.details.map((item) => (
              <div key={item.type} className="signal-card signal-positive">
                <span>{item.type}</span>
                <strong>{item.impactPct}%</strong>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {riskProfile.risques?.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Risques identifies</strong>
          </div>
          <div className="info-chip-list">
            {riskProfile.risques.slice(0, 12).map((item, index) => (
              <span key={`${extractRiskLabel(item)}_${index}`} className="info-chip">
                {extractRiskLabel(item)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </InfoPanelShell>
  );
}
