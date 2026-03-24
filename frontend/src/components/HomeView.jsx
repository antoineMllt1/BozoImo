import { fmtDate, fmtPm2, fmtK } from '../utils/formatters';
import { modelStats } from '../utils/model';

const STATUS_LABEL = { draft: 'Brouillon', estimated: 'Estimé', confirmed: 'Confirmé' };
const STATUS_CLASS = { draft: 'badge-draft', estimated: 'badge-estimated', confirmed: 'badge-confirmed' };
const RADIUS_LABELS = { 250: '250m', 500: '500m', 1000: '1km', 2000: '2km', 5000: '5km' };

export default function HomeView({ dossiers, model, onNew, onScrape, onOpen, onDelete }) {
  const stats = modelStats(model.samples, model.correctionFactor);

  return (
    <div className="home-view">
      {/* Model stats bar */}
      {stats ? (
        <div className="model-bar">
          <div className="model-stat">
            <span className="model-stat-label">Confirmations</span>
            <span className="model-stat-value">{stats.n}</span>
          </div>
          <div className="model-stat">
            <span className="model-stat-label">Erreur moyenne</span>
            <span className="model-stat-value">{fmtPm2(stats.mae)}</span>
          </div>
          <div className="model-stat">
            <span className="model-stat-label">Erreur %</span>
            <span className="model-stat-value">{stats.mape} %</span>
          </div>
          <div className="model-stat">
            <span className="model-stat-label">Facteur correcteur</span>
            <span className={`model-stat-value ${stats.biasPct > 2 ? 'val-up' : stats.biasPct < -2 ? 'val-down' : ''}`}>
              × {stats.correctionFactor.toFixed(3)}
              &nbsp;<span className="model-stat-hint">
                ({stats.biasPct > 0 ? '+' : ''}{stats.biasPct}%)
              </span>
            </span>
          </div>
          <div className="model-stat model-stat-info">
            <span className="model-stat-label">Algorithme d&apos;apprentissage</span>
            <span className="model-stat-value model-stat-desc">
              Médiane pondérée DVF + correction géométrique sur {stats.n} confirmation{stats.n > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      ) : (
        <div className="model-bar model-bar-cold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>
            <strong>Modèle non encore calibré.</strong>{' '}
            Confirmez votre première estimation après la transaction pour démarrer l&apos;apprentissage.
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="home-cta">
        <div>
          <h2 className="home-title">Dossiers d&apos;analyse</h2>
          <p className="home-sub">
            {dossiers.length === 0
              ? 'Aucun dossier pour l\'instant. Lancez votre première analyse.'
              : `${dossiers.length} dossier${dossiers.length > 1 ? 's' : ''} enregistré${dossiers.length > 1 ? 's' : ''}.`
            }
          </p>
        </div>
        <div className="home-cta-btns">
          <button className="scrape-btn" onClick={onScrape}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Collecte rapide
          </button>
          <button className="new-btn" onClick={onNew}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nouvelle analyse
          </button>
        </div>
      </div>

      {/* Dossier list */}
      {dossiers.length === 0 ? (
        <div className="home-empty">
          <div className="home-empty-grid">
            <div className="he-card">
              <div className="he-step-num">1</div>
              <h4>Saisissez une adresse</h4>
              <p>Entrez l&apos;adresse exacte du bien à analyser et choisissez le rayon de recherche.</p>
            </div>
            <div className="he-card">
              <div className="he-step-num">2</div>
              <h4>Étude de marché</h4>
              <p>L&apos;outil extrait et analyse les transactions DVF et annonces SeLoger autour du bien.</p>
            </div>
            <div className="he-card">
              <div className="he-step-num">3</div>
              <h4>Grille de prix</h4>
              <p>Valorisez chaque lot avec les coefficients (étage, DPE, vue, état…) — comme dans votre Excel.</p>
            </div>
            <div className="he-card">
              <div className="he-step-num">4</div>
              <h4>Confirmez & affinez</h4>
              <p>Confirmez le prix réel après la transaction pour améliorer les estimations futures.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="dossier-list">
          <div className="dossier-list-head">
            <span>Adresse</span>
            <span>Rayon</span>
            <span>Estimation</span>
            <span>Statut</span>
            <span>Date</span>
            <span></span>
          </div>
          {dossiers.map(d => {
            const est = d.lastEstimate;
            return (
              <div key={d.id} className="dossier-row" onClick={() => onOpen(d.id)}>
                <div className="dr-address">
                  <span className="dr-addr-text">{d.address}</span>
                  {d.target?.surfaceM2 && (
                    <span className="dr-addr-meta">
                      {d.target.surfaceM2} m²
                      {d.target.rooms ? ` · ${d.target.rooms}P` : ''}
                      {d.target.type ? ` · ${d.target.type === 'Apartment' ? 'Appt' : 'Maison'}` : ''}
                    </span>
                  )}
                </div>
                <span className="dr-radius">{RADIUS_LABELS[d.radiusMeters] || `${d.radiusMeters}m`}</span>
                <span className="dr-estimate">
                  {est ? fmtPm2(est.correctedPm2) : <span className="dr-no-est">—</span>}
                  {est && d.target?.surfaceM2 && (
                    <span className="dr-price"> · {fmtK(est.estimatedPrice)}</span>
                  )}
                </span>
                <span className={`status-badge ${STATUS_CLASS[d.status] || 'badge-draft'}`}>
                  {STATUS_LABEL[d.status] || 'Brouillon'}
                </span>
                <span className="dr-date">{fmtDate(d.createdAt)}</span>
                <button
                  className="dr-del"
                  title="Supprimer ce dossier"
                  onClick={e => { e.stopPropagation(); onDelete(d.id); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
