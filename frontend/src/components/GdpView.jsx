import { useState, useMemo, useEffect } from 'react';
import { DEFAULT_COEFFICIENTS, computeLot, newLot } from '../utils/gdp';
import { fmtK, fmtPm2 } from '../utils/formatters';
import GdpLotModal from './GdpLotModal';

const ALERT_ICON = { danger: '🔴', warn: '🟡' };

function AlertBadge({ alerts }) {
  if (!alerts?.length) return null;
  const worst = alerts.find(a => a.type === 'danger') ? 'danger' : 'warn';
  return <span className={`gdp-alert-dot gdp-alert-${worst}`} title={alerts.map(a => a.msg).join('\n')}>{ALERT_ICON[worst]}</span>;
}

export default function GdpView({ dossier, prixPivot: initPivot, onUpdate }) {
  const [lots,       setLots]       = useState(dossier.lots || []);
  const [coefficients]              = useState(DEFAULT_COEFFICIENTS);
  const [prixPivot,  setPrixPivot]  = useState(initPivot || dossier.prixPivot || null);

  useEffect(() => {
    if (initPivot != null) setPrixPivot(initPivot);
  }, [initPivot]);
  const [editLot,    setEditLot]    = useState(null); // lot being edited (null = closed)
  const [isNew,      setIsNew]      = useState(false);

  const computedLots = useMemo(
    () => lots.map(l => ({ ...l, computed: computeLot(l, prixPivot, coefficients) })),
    [lots, prixPivot, coefficients]
  );

  const kpis = useMemo(() => {
    const cl = computedLots;
    if (!cl.length) return null;
    const vacant = cl.reduce((s, l) => s + (l.computed?.prixFai || 0), 0);
    const total  = cl.reduce((s, l) => s + (l.computed?.prixFinal || 0), 0);
    const travaux= cl.reduce((s, l) => s + (l.computed?.travaux || 0), 0);
    const totalSHAB = cl.reduce((s, l) => s + (l.SHAB || 0), 0);
    const nAlerts= cl.filter(l => l.computed?.alerts?.length).length;
    const ppm2   = totalSHAB > 0 ? Math.round(total / totalSHAB) : null;
    return { vacant, total, travaux, ppm2, nAlerts, n: cl.length };
  }, [computedLots]);

  const persist = (newLots) => {
    setLots(newLots);
    onUpdate?.({ ...dossier, lots: newLots, prixPivot });
  };

  const handleSave = (saved) => {
    const updated = isNew
      ? [...lots, saved]
      : lots.map(l => l.id === saved.id ? saved : l);
    persist(updated);
    setEditLot(null);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer ce lot ?')) return;
    persist(lots.filter(l => l.id !== id));
  };

  return (
    <div className="gdp-view">
      {/* Guide banner when no pivot */}
      {!prixPivot && (
        <div className="gdp-guide-banner">
          <span className="gdp-guide-icon">💡</span>
          <div>
            <strong>Commencez par l'onglet "Analyse de marché"</strong> pour calculer le Prix Pivot,
            puis cliquez sur "Envoyer à la Grille de prix". Vous pouvez aussi saisir un prix manuellement ci-dessous.
          </div>
        </div>
      )}

      {/* Prix Pivot input */}
      <div className="gdp-pivot-bar">
        <label className="gdp-pivot-label">Prix Pivot (€/m²)</label>
        <input type="number" className="gdp-pivot-input" placeholder="Ex : 4 500"
          value={prixPivot ?? ''}
          onChange={e => setPrixPivot(e.target.value ? +e.target.value : null)} />
        {prixPivot && <span className="gdp-pivot-set">✓ Prix Pivot défini — vous pouvez ajouter vos lots</span>}
      </div>

      {/* Lots table */}
      <div className="gdp-table-wrap">
        <div className="gdp-table-head">
          <span>{computedLots.length} lot{computedLots.length > 1 ? 's' : ''}</span>
          <button className="btn-primary btn-sm" onClick={() => { setEditLot(newLot()); setIsNew(true); }}>
            + Ajouter un lot
          </button>
        </div>

        {computedLots.length === 0 ? (
          <div className="empty-state">
            <span>🏢</span>
            <p>{prixPivot ? 'Prix Pivot défini — ajoutez vos lots pour calculer leur valeur.' : 'Définissez le Prix Pivot puis ajoutez vos lots.'}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N° UG</th><th>Nature</th><th>Type</th><th>Ét.</th>
                  <th>Orient.</th><th>DPE</th><th>Vue</th><th>État</th>
                  <th>SHAB</th><th>Surf. pond.</th>
                  <th>Statut</th><th>Prix FAI</th><th>Prix final</th>
                  <th>Alertes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {computedLots.map(l => {
                  const c = l.computed;
                  return (
                    <tr key={l.id} className={c?.alerts?.length ? 'gdp-row-alert' : ''}>
                      <td className="td-c">{l.ugNumber || '—'}</td>
                      <td>{l.nature}</td>
                      <td className="td-c">{l.type}</td>
                      <td className="td-c">{l.floor ?? '—'}</td>
                      <td className="td-c">{l.orientation || '—'}</td>
                      <td className="td-c">
                        {l.dpe
                          ? <span className={`dpe-badge dpe-${l.dpe}`}>{l.dpe}</span>
                          : '—'}
                      </td>
                      <td className="td-vue">{l.vue || <span className="td-missing">Non renseigné</span>}</td>
                      <td className="td-etat">{l.etat || <span className="td-missing">Non renseigné</span>}</td>
                      <td className="td-c">{l.SHAB ? `${l.SHAB} m²` : '—'}</td>
                      <td className="td-c">{c?.surfPond ? `${c.surfPond.toFixed(1)} m²` : '—'}</td>
                      <td className="td-c">
                        <span className={`occ-badge ${l.isOccupied ? 'occ-oui' : 'occ-non'}`}>
                          {l.isOccupied ? 'Occupé' : 'Vacant'}
                        </span>
                      </td>
                      <td className="td-price">{c?.prixFai ? fmtK(c.prixFai) : '—'}</td>
                      <td className="td-price td-price-main">
                        {c?.prixFinal ? fmtK(c.prixFinal) : '—'}
                      </td>
                      <td><AlertBadge alerts={c?.alerts} /></td>
                      <td>
                        <div className="gdp-row-actions">
                          <button className="link-btn" onClick={() => { setEditLot(l); setIsNew(false); }}>Éditer</button>
                          <button className="link-btn link-btn-del" onClick={() => handleDelete(l.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="gdp-kpis">
          <div className="gdp-kpi"><span className="gdp-kpi-lbl">Lots</span><span className="gdp-kpi-val">{kpis.n}</span></div>
          <div className="gdp-kpi"><span className="gdp-kpi-lbl">Valeur totale</span><span className="gdp-kpi-val">{fmtK(kpis.total)}</span></div>
          <div className="gdp-kpi"><span className="gdp-kpi-lbl">€/m² moy. pond.</span><span className="gdp-kpi-val">{fmtPm2(kpis.ppm2)}</span></div>
          <div className="gdp-kpi"><span className="gdp-kpi-lbl">Total travaux</span><span className="gdp-kpi-val">{fmtK(kpis.travaux)}</span></div>
          {kpis.nAlerts > 0 && (
            <div className="gdp-kpi gdp-kpi-alert"><span className="gdp-kpi-lbl">Alertes</span><span className="gdp-kpi-val">{kpis.nAlerts}</span></div>
          )}
        </div>
      )}

      {/* Modal */}
      {editLot && (
        <GdpLotModal
          lot={editLot}
          prixPivot={prixPivot}
          coefficients={coefficients}
          onSave={handleSave}
          onClose={() => setEditLot(null)}
        />
      )}
    </div>
  );
}
