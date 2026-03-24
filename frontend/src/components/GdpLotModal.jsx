import { useState } from 'react';
import { DEFAULT_COEFFICIENTS, VUE_OPTIONS, ETAT_OPTIONS, computeLot, computeSurfacePonderee } from '../utils/gdp';
import { fmtK, fmtPm2 } from '../utils/formatters';

const TYPES = ['T1','T2','T3','T4','T5'];
const DPELIST = ['A','B','C','D','E','F','G'];
const ORIENTATIONS = ['N','E','S','O'];

function Row({ label, children }) {
  return (
    <div className="glm-row">
      <label className="glm-label">{label}</label>
      <div className="glm-ctrl">{children}</div>
    </div>
  );
}

export default function GdpLotModal({ lot: initLot, prixPivot, coefficients = DEFAULT_COEFFICIENTS, onSave, onClose }) {
  const [lot, setLot] = useState(initLot);
  const f = (k, v) => setLot(p => ({ ...p, [k]: v }));

  const computed = prixPivot ? computeLot(lot, prixPivot, coefficients) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel glm-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{lot.ugNumber ? `Lot ${lot.ugNumber}` : 'Nouveau lot'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="glm-body">
          {/* Left: form */}
          <div className="glm-form">
            <div className="glm-section">Identification</div>
            <Row label="N° UG">
              <input className="glm-input" value={lot.ugNumber} onChange={e => f('ugNumber', e.target.value)} placeholder="Ex : A01" />
            </Row>
            <Row label="Nature">
              <input className="glm-input" value={lot.nature} onChange={e => f('nature', e.target.value)} />
            </Row>
            <Row label="Type">
              <div className="ef-chips">
                {TYPES.map(t => (
                  <button key={t} type="button" className={`ef-chip ${lot.type === t ? 'on' : ''}`} onClick={() => f('type', t)}>{t}</button>
                ))}
              </div>
            </Row>
            <Row label="Ascenseur">
              <label className="ef-toggle">
                <input type="checkbox" checked={!!lot.hasElevator} onChange={e => f('hasElevator', e.target.checked)} />
                <span className="ef-tog-track"><span className="ef-tog-thumb" /></span>
              </label>
            </Row>

            <div className="glm-section">Surface</div>
            <Row label="SHAB (m²)">
              <input type="number" className="glm-input glm-input-sm" value={lot.SHAB ?? ''} onChange={e => f('SHAB', e.target.value ? +e.target.value : null)} />
            </Row>
            <Row label="Surface ext. (m²)">
              <input type="number" className="glm-input glm-input-sm" value={lot.surface_ext ?? 0} onChange={e => f('surface_ext', +e.target.value)} />
              {lot.SHAB && <span className="glm-hint">Pondérée : {computeSurfacePonderee(lot.SHAB, lot.surface_ext).toFixed(1)} m²</span>}
            </Row>

            <div className="glm-section">Coefficients</div>
            <Row label="Étage">
              <input type="number" min="0" max="20" className="glm-input glm-input-sm" value={lot.floor ?? 0} onChange={e => f('floor', +e.target.value)} />
            </Row>
            <Row label="Orientation">
              <div className="ef-chips">
                {[null, ...ORIENTATIONS].map(o => (
                  <button key={o ?? 'none'} type="button" className={`ef-chip ${lot.orientation === o ? 'on' : ''}`} onClick={() => f('orientation', o)}>
                    {o ?? '—'}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="DPE">
              <div className="ef-chips">
                {[null, ...DPELIST].map(d => (
                  <button key={d ?? 'none'} type="button" className={`ef-chip ${d ? `ef-dpe-${d}` : ''} ${lot.dpe === d ? 'on' : ''}`} onClick={() => f('dpe', d)}>
                    {d ?? '—'}
                  </button>
                ))}
              </div>
              {(lot.dpe === 'F' || lot.dpe === 'G') && <div className="glm-alert glm-alert-danger">⚠️ Passoire thermique</div>}
            </Row>
            <Row label="Vue">
              <select className="glm-select" value={lot.vue ?? ''} onChange={e => f('vue', e.target.value || null)}>
                <option value="">— Non renseigné</option>
                {VUE_OPTIONS.map(v => <option key={v} value={v}>{v} (×{DEFAULT_COEFFICIENTS.vue[v].toFixed(2)})</option>)}
              </select>
            </Row>
            <Row label="État">
              <select className="glm-select" value={lot.etat ?? ''} onChange={e => f('etat', e.target.value || null)}>
                <option value="">— Non renseigné</option>
                {ETAT_OPTIONS.map(e => <option key={e} value={e}>{e} (×{DEFAULT_COEFFICIENTS.etat[e].toFixed(2)})</option>)}
              </select>
            </Row>

            <div className="glm-section">Parking & Travaux</div>
            <Row label="Nb parkings">
              <input type="number" min="0" className="glm-input glm-input-sm" value={lot.parking_count ?? 0} onChange={e => f('parking_count', +e.target.value)} />
            </Row>
            {lot.parking_count > 0 && (
              <Row label="Prix / parking (€)">
                <input type="number" min="0" className="glm-input glm-input-sm" value={lot.parking_unit_price ?? 0} onChange={e => f('parking_unit_price', +e.target.value)} />
              </Row>
            )}
            <Row label="Travaux estimés (€)">
              <input type="number" min="0" className="glm-input glm-input-sm" value={lot.travaux_estime ?? 0} onChange={e => f('travaux_estime', +e.target.value)} />
            </Row>

            <div className="glm-section">
              Occupation
              <label className="ef-toggle" style={{marginLeft:8}}>
                <input type="checkbox" checked={!!lot.isOccupied} onChange={e => f('isOccupied', e.target.checked)} />
                <span className="ef-tog-track"><span className="ef-tog-thumb" /></span>
              </label>
            </div>
            {lot.isOccupied && (<>
              <Row label="Loyer en place (€/mois)">
                <input type="number" className="glm-input glm-input-sm" value={lot.loyer_en_place ?? ''} onChange={e => f('loyer_en_place', +e.target.value)} />
              </Row>
              <Row label="Loyer marché estimé (€/mois)">
                <input type="number" className="glm-input glm-input-sm" value={lot.loyer_marche_estime ?? ''} onChange={e => f('loyer_marche_estime', +e.target.value)} />
              </Row>
              <Row label="Âge locataire">
                <input type="number" className="glm-input glm-input-sm" value={lot.age_locataire ?? ''} onChange={e => f('age_locataire', e.target.value ? +e.target.value : null)} />
                {lot.age_locataire > 59 && <div className="glm-alert glm-alert-danger">⚠️ Locataire protégé — Loi 89 renforcée</div>}
              </Row>
              <Row label="Décote durée (%)">
                <input type="number" min="0" max="30" step="1" className="glm-input glm-input-sm" value={Math.round((lot.decote_duree ?? 0) * 100)} onChange={e => f('decote_duree', +e.target.value / 100)} />
              </Row>
            </>)}
          </div>

          {/* Right: calculation sheet */}
          <div className="glm-sheet">
            <div className="gls-title">Fiche de calcul</div>
            {!prixPivot ? (
              <div className="gls-empty">Prix Pivot non défini — calculez-le dans l'EDM d'abord.</div>
            ) : !lot.SHAB ? (
              <div className="gls-empty">Renseignez la SHAB pour voir le calcul.</div>
            ) : computed ? (<>
              <div className="gls-block">
                <div className="gls-block-title">Surface</div>
                <div className="gls-line"><span>SHAB</span><span>{lot.SHAB} m²</span></div>
                <div className="gls-line"><span>Surface ext. × 0.20</span><span>{((lot.surface_ext || 0) * 0.20).toFixed(1)} m²</span></div>
                <div className="gls-line gls-total"><span>Surface pondérée</span><span>{computed.surfPond?.toFixed(1)} m²</span></div>
              </div>
              <div className="gls-block">
                <div className="gls-block-title">Prix Pivot ({lot.type})</div>
                <div className="gls-line gls-total"><span>{fmtPm2(prixPivot)}</span></div>
              </div>
              {computed.detail && (
                <div className="gls-block">
                  <div className="gls-block-title">Coefficients</div>
                  <div className="gls-line"><span>Étage {lot.floor} ({lot.hasElevator ? 'avec asc.' : 'sans asc.'})</span><span>× {computed.detail.cFloor.toFixed(2)}</span></div>
                  <div className="gls-line"><span>Orientation {lot.orientation || '—'}</span><span>× {computed.detail.cOrient.toFixed(2)}</span></div>
                  <div className="gls-line"><span>DPE {lot.dpe || '—'}</span><span>× {computed.detail.cDpe.toFixed(2)}</span></div>
                  <div className="gls-line"><span>Vue : {lot.vue || '—'}</span><span>× {computed.detail.cVue.toFixed(2)}</span></div>
                  <div className="gls-line"><span>État : {lot.etat || '—'}</span><span>× {computed.detail.cEtat.toFixed(2)}</span></div>
                  <div className="gls-line gls-total"><span>Coeff. combiné</span><span>× {computed.coeffCombined?.toFixed(4)}</span></div>
                </div>
              )}
              <div className="gls-block">
                <div className="gls-block-title">Prix FAI vacant</div>
                <div className="gls-formula">{fmtPm2(prixPivot)} × {computed.coeffCombined?.toFixed(4)} × {computed.surfPond?.toFixed(1)} m²</div>
                <div className="gls-result">{fmtK(computed.prixFai)}</div>
                {lot.SHAB > 0 && <div className="gls-ppm2">soit {fmtPm2(Math.round(computed.prixFai / lot.SHAB))} (SHAB)</div>}
              </div>
              {lot.isOccupied && computed.prixOccupe != null && (
                <div className="gls-block">
                  <div className="gls-block-title">Décotes occupation</div>
                  <div className="gls-line"><span>Décote reversion</span><span>−{Math.round(computed.dRev * 100)}%</span></div>
                  {computed.dAge > 0 && <div className="gls-line gls-warn"><span>Décote âge (&gt;59 ans)</span><span>−{Math.round(computed.dAge * 100)}%</span></div>}
                  {computed.dDuree > 0 && <div className="gls-line"><span>Décote durée</span><span>−{Math.round(computed.dDuree * 100)}%</span></div>}
                  <div className="gls-line gls-total"><span>Décote totale</span><span>−{Math.round(computed.decoteTotal * 100)}%</span></div>
                  <div className="gls-result">{fmtK(computed.prixOccupe)} (occupé)</div>
                </div>
              )}
              {(computed.travaux > 0 || computed.parking > 0) && (
                <div className="gls-block">
                  {computed.parking > 0 && <div className="gls-line"><span>Parking(s) {lot.parking_count} × {fmtK(lot.parking_unit_price)}</span><span>+ {fmtK(computed.parking)}</span></div>}
                  {computed.travaux > 0 && <div className="gls-line gls-neg"><span>Travaux estimés</span><span>− {fmtK(computed.travaux)}</span></div>}
                  <div className="gls-line gls-total"><span>Prix net réel</span><span>{fmtK(computed.prixNet)}</span></div>
                </div>
              )}
              {computed.alerts?.length > 0 && (
                <div className="gls-block">
                  <div className="gls-block-title">Alertes</div>
                  {computed.alerts.map((a, i) => (
                    <div key={i} className={`glm-alert glm-alert-${a.type}`}>{a.msg}</div>
                  ))}
                </div>
              )}
            </>) : null}
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={() => onSave(lot)}>Enregistrer le lot</button>
        </div>
      </div>
    </div>
  );
}
