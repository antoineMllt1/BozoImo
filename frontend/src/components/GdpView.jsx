import { useMemo, useState } from 'react';
import ExampleNumberField from './ui/number-field-1';
import GdpLotModal from './GdpLotModal';
import { fmtK, fmtPm2 } from '../utils/formatters';
import { DEFAULT_COEFFICIENTS, computeLot, newLot } from '../utils/gdp';

const ALERT_ICON = { danger: '!', warn: 'i' };

function AlertBadge({ alerts }) {
  if (!alerts?.length) return null;

  const worst = alerts.find(alert => alert.type === 'danger') ? 'danger' : 'warn';

  return (
    <span
      className={`gdp-alert-dot gdp-alert-${worst}`}
      title={alerts.map(alert => alert.msg).join('\n')}
    >
      {ALERT_ICON[worst]}
    </span>
  );
}

export default function GdpView({ dossier, prixPivot: initPivot, onUpdate }) {
  const [lots, setLots] = useState(dossier.lots || []);
  const [coefficients] = useState(DEFAULT_COEFFICIENTS);
  const [localPrixPivot, setLocalPrixPivot] = useState(dossier.prixPivot || null);
  const [editLot, setEditLot] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const prixPivot = initPivot ?? localPrixPivot;

  const computedLots = useMemo(
    () => lots.map(lot => ({ ...lot, computed: computeLot(lot, prixPivot, coefficients) })),
    [lots, prixPivot, coefficients]
  );

  const kpis = useMemo(() => {
    if (!computedLots.length) return null;

    const vacant = computedLots.reduce((sum, lot) => sum + (lot.computed?.prixFai || 0), 0);
    const total = computedLots.reduce((sum, lot) => sum + (lot.computed?.prixFinal || 0), 0);
    const travaux = computedLots.reduce((sum, lot) => sum + (lot.computed?.travaux || 0), 0);
    const totalSHAB = computedLots.reduce((sum, lot) => sum + (lot.SHAB || 0), 0);
    const nAlerts = computedLots.filter(lot => lot.computed?.alerts?.length).length;
    const ppm2 = totalSHAB > 0 ? Math.round(total / totalSHAB) : null;

    return { vacant, total, travaux, ppm2, nAlerts, n: computedLots.length };
  }, [computedLots]);

  const persist = (newLots, nextPrixPivot = prixPivot) => {
    setLots(newLots);
    onUpdate?.({ ...dossier, lots: newLots, prixPivot: nextPrixPivot });
  };

  const handlePivotChange = nextValue => {
    setLocalPrixPivot(nextValue);
    onUpdate?.({ ...dossier, lots, prixPivot: nextValue });
  };

  const handleSave = saved => {
    const updatedLots = isNew
      ? [...lots, saved]
      : lots.map(lot => (lot.id === saved.id ? saved : lot));

    persist(updatedLots);
    setEditLot(null);
  };

  const handleDelete = id => {
    if (!window.confirm('Supprimer ce lot ?')) return;
    persist(lots.filter(lot => lot.id !== id));
  };

  return (
    <div className="gdp-view">
      {!prixPivot && (
        <div className="gdp-guide-banner">
          <span className="gdp-guide-icon">i</span>
          <div>
            <strong>Commencez par l&apos;onglet &laquo; Etude de marche &raquo;</strong> pour calculer le Prix Pivot,
            puis cliquez sur &laquo; Envoyer a la Grille de prix &raquo;. Vous pouvez aussi saisir un prix manuellement ci-dessous.
          </div>
        </div>
      )}

      <div className="gdp-pivot-bar">
        <ExampleNumberField
          label="Prix Pivot (EUR/m2)"
          placeholder="4500"
          min={0}
          step={50}
          value={prixPivot}
          defaultValue={4500}
          onValueChange={handlePivotChange}
          size="md"
        />
        {prixPivot && <span className="gdp-pivot-set">Prix Pivot defini, vous pouvez ajouter vos lots.</span>}
      </div>

      {kpis && (
        <div className="edm-kpi-row" style={{ gridTemplateColumns: `repeat(${kpis.nAlerts > 0 ? 5 : 4}, 1fr)` }}>
          <div className="edm-kpi-card">
            <span className="edm-kpi-icon">B</span>
            <div>
              <span className="edm-kpi-val">{kpis.n}</span>
              <span className="edm-kpi-lbl">Lots saisis</span>
            </div>
          </div>
          <div className="edm-kpi-card">
            <span className="edm-kpi-icon">E</span>
            <div>
              <span className="edm-kpi-val">{fmtK(kpis.total)}</span>
              <span className="edm-kpi-lbl">Valeur totale</span>
            </div>
          </div>
          <div className="edm-kpi-card">
            <span className="edm-kpi-icon">M</span>
            <div>
              <span className="edm-kpi-val">{fmtPm2(kpis.ppm2)}</span>
              <span className="edm-kpi-lbl">EUR/m2 moyen pondere</span>
            </div>
          </div>
          <div className="edm-kpi-card">
            <span className="edm-kpi-icon">T</span>
            <div>
              <span className="edm-kpi-val">{fmtK(kpis.travaux)}</span>
              <span className="edm-kpi-lbl">Budget travaux</span>
            </div>
          </div>
          {kpis.nAlerts > 0 && (
            <div className="edm-kpi-card" style={{ borderColor: '#fde68a', background: '#fffbeb' }}>
              <span className="edm-kpi-icon">!</span>
              <div>
                <span className="edm-kpi-val" style={{ color: '#d97706' }}>{kpis.nAlerts}</span>
                <span className="edm-kpi-lbl">Alertes</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="gdp-table-wrap">
        <div className="gdp-table-head">
          <span>
            {computedLots.length} lot{computedLots.length > 1 ? 's' : ''}
            {prixPivot ? ` · Prix Pivot ${Math.round(prixPivot).toLocaleString('fr-FR')} EUR/m2` : ''}
          </span>
          <button
            className="btn-primary btn-sm"
            onClick={() => {
              setEditLot(newLot());
              setIsNew(true);
            }}
          >
            + Ajouter un lot
          </button>
        </div>

        {computedLots.length === 0 ? (
          <div className="empty-state">
            <span>B</span>
            <p>
              {prixPivot
                ? 'Prix Pivot defini, cliquez sur "+ Ajouter un lot" pour commencer la valorisation.'
                : 'Definissez le Prix Pivot ci-dessus, puis ajoutez vos lots pour calculer leur valeur.'}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No UG</th>
                  <th>Nature</th>
                  <th>Type</th>
                  <th>Et.</th>
                  <th>Orient.</th>
                  <th>DPE</th>
                  <th>Vue</th>
                  <th>Etat</th>
                  <th>SHAB</th>
                  <th>Surf. pond.</th>
                  <th>Statut</th>
                  <th>Prix FAI</th>
                  <th>Prix final</th>
                  <th>Alertes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {computedLots.map(lot => {
                  const computed = lot.computed;

                  return (
                    <tr key={lot.id} className={computed?.alerts?.length ? 'gdp-row-alert' : ''}>
                      <td className="td-c">{lot.ugNumber || '-'}</td>
                      <td>{lot.nature}</td>
                      <td className="td-c">{lot.type}</td>
                      <td className="td-c">{lot.floor ?? '-'}</td>
                      <td className="td-c">{lot.orientation || '-'}</td>
                      <td className="td-c">
                        {lot.dpe ? <span className={`dpe-badge dpe-${lot.dpe}`}>{lot.dpe}</span> : '-'}
                      </td>
                      <td className="td-vue">{lot.vue || <span className="td-missing">Non renseigne</span>}</td>
                      <td className="td-etat">{lot.etat || <span className="td-missing">Non renseigne</span>}</td>
                      <td className="td-c">{lot.SHAB ? `${lot.SHAB} m2` : '-'}</td>
                      <td className="td-c">{computed?.surfPond ? `${computed.surfPond.toFixed(1)} m2` : '-'}</td>
                      <td className="td-c">
                        <span className={`occ-badge ${lot.isOccupied ? 'occ-oui' : 'occ-non'}`}>
                          {lot.isOccupied ? 'Occupe' : 'Vacant'}
                        </span>
                      </td>
                      <td className="td-price">{computed?.prixFai ? fmtK(computed.prixFai) : '-'}</td>
                      <td className="td-price td-price-main">{computed?.prixFinal ? fmtK(computed.prixFinal) : '-'}</td>
                      <td>
                        <AlertBadge alerts={computed?.alerts} />
                      </td>
                      <td>
                        <div className="gdp-row-actions">
                          <button
                            className="link-btn"
                            onClick={() => {
                              setEditLot(lot);
                              setIsNew(false);
                            }}
                          >
                            Editer
                          </button>
                          <button className="link-btn link-btn-del" onClick={() => handleDelete(lot.id)}>
                            x
                          </button>
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
