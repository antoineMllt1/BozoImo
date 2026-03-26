import { estimateRenovationCost } from '../utils/investment';
import { InfoEmpty, InfoPanelShell, InfoStatGrid } from './InfoPanelShell';

const ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

export default function DPEPanel({ snapshot, target }) {
  const results = snapshot?.results || [];
  if (!results.length && !target?.dpe) {
    return (
      <InfoEmpty
        title="Energie indisponible"
        body="Aucun DPE de voisinage ni DPE cible n'est disponible pour ce dossier."
      />
    );
  }

  const distribution = ORDER.reduce((acc, grade) => ({ ...acc, [grade]: 0 }), {});
  results.forEach((item) => {
    const grade = String(item.dpe || '').charAt(0).toUpperCase();
    if (distribution[grade] != null) distribution[grade] += 1;
  });

  const ranked = results
    .map((item) => ORDER.indexOf(String(item.dpe || '').charAt(0).toUpperCase()) + 1)
    .filter((value) => value > 0);
  const avgRank = ranked.length ? ranked.reduce((sum, value) => sum + value, 0) / ranked.length : null;
  const medianConso = median(results.map((item) => Number(item.conso)).filter(Number.isFinite));

  let renovation = null;
  if (target?.dpe && target?.surfaceM2) {
    const current = target.dpe;
    const targetGrade = current === 'G' || current === 'F' || current === 'E' ? 'D' : current === 'D' ? 'C' : null;
    renovation = targetGrade ? estimateRenovationCost(current, targetGrade, target.surfaceM2) : null;
  }

  return (
    <InfoPanelShell
      title="Energie"
      subtitle="Diagnostics de performance energetique du voisinage et scenario de renovation."
    >
      <InfoStatGrid
        items={[
          { label: 'DPE voisins', value: results.length },
          { label: 'Moyenne quartier', value: avgRank ? ORDER[Math.max(0, Math.min(ORDER.length - 1, Math.round(avgRank) - 1))] : null },
          { label: 'Conso mediane', value: medianConso ? `${Math.round(medianConso)} kWhEF/an` : null },
          { label: 'DPE cible', value: target?.dpe || null },
        ]}
      />

      {results.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Repartition du voisinage</strong>
          </div>
          <div className="dpe-distribution">
            {ORDER.map((grade) => {
              const count = distribution[grade];
              const width = results.length ? (count / results.length) * 100 : 0;
              return (
                <div key={grade} className="dpe-row">
                  <span>{grade}</span>
                  <div className="dpe-bar-track">
                    <div className={`dpe-bar dpe-${grade.toLowerCase()}`} style={{ width: `${width}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {renovation ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Scenario de renovation</strong>
          </div>
          <InfoStatGrid
            items={[
              { label: 'Objectif', value: `${renovation.currentDpe} -> ${renovation.targetDpe}` },
              { label: 'Budget estime', value: `${renovation.totalCost.toLocaleString('fr-FR')} EUR` },
              { label: 'Surface', value: `${renovation.surfaceM2} m2` },
            ]}
          />
        </div>
      ) : null}
    </InfoPanelShell>
  );
}
