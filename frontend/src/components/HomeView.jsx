import { fmtDate, fmtK, fmtPm2 } from '../utils/formatters';
import { modelStats } from '../utils/model';

const STATUS_LABEL = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  estimated: 'Estime',
  confirmed: 'Confirme',
  archived: 'Archive',
};

const STATUS_CLASS = {
  draft: 'badge-draft',
  in_progress: 'badge-estimated',
  estimated: 'badge-estimated',
  confirmed: 'badge-confirmed',
  archived: 'badge-archived',
};

const RADIUS_LABELS = { 250: '250m', 500: '500m', 1000: '1km', 2000: '2km', 5000: '5km' };

function renderStars(stars = 0) {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
}

function DossierCard({ dossier, onOpen, onDelete, onDuplicate, onArchive }) {
  const estimate = dossier.lastEstimate;
  const isArchived = Boolean(dossier.archivedAt);
  const cover = dossier.coverPhoto?.dataUrl;

  return (
    <article className={`dossier-card ${isArchived ? 'is-archived' : ''}`} onClick={() => onOpen(dossier.id)}>
      <div className="dossier-card-cover">
        {cover ? (
          <img src={cover} alt={dossier.address} />
        ) : (
          <div className="dossier-card-placeholder">
            <span>{dossier.target?.type === 'House' ? 'Maison' : 'Appartement'}</span>
            <strong>{dossier.target?.surfaceM2 ? `${dossier.target.surfaceM2} m²` : 'Dossier'}</strong>
          </div>
        )}
        <div className="dossier-card-topline">
          <span className={`status-badge ${STATUS_CLASS[dossier.status] || 'badge-draft'}`}>
            {STATUS_LABEL[dossier.status] || 'Brouillon'}
          </span>
          {estimate?.confidence && (
            <span className="confidence-mini">
              {renderStars(estimate.confidence.stars)}
            </span>
          )}
        </div>
      </div>

      <div className="dossier-card-body">
        <div className="dossier-card-head">
          <div>
            <h3>{dossier.address}</h3>
            <p>
              {RADIUS_LABELS[dossier.radiusMeters] || `${dossier.radiusMeters}m`}
              {dossier.target?.rooms ? ` · ${dossier.target.rooms}P` : ''}
              {dossier.target?.type ? ` · ${dossier.target.type === 'House' ? 'Maison' : 'Appartement'}` : ''}
            </p>
          </div>
          <button
            className="dossier-quick-btn"
            title="Dupliquer"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(dossier.id);
            }}
          >
            ⧉
          </button>
        </div>

        <div className="dossier-card-metrics">
          <div>
            <span>Estimation</span>
            <strong>{estimate ? fmtPm2(estimate.correctedPm2) : '-'}</strong>
            <small>{estimate?.estimatedPrice ? fmtK(estimate.estimatedPrice) : 'En attente'}</small>
          </div>
          <div>
            <span>Confiance</span>
            <strong>{estimate?.confidence ? `${estimate.confidence.score}/100` : '-'}</strong>
            <small>{estimate?.confidence?.label || 'Pas encore calculee'}</small>
          </div>
        </div>

        <p className="dossier-card-desc">
          {dossier.propertyDescription || 'Ajoutez une description du bien, des travaux, ou des hypotheses de valorisation.'}
        </p>

        <div className="dossier-card-footer">
          <div className="dossier-card-meta">
            <span>{fmtDate(dossier.updatedAt || dossier.createdAt)}</span>
            {estimate?.confidence && <span>{renderStars(estimate.confidence.stars)}</span>}
          </div>
          <div className="dossier-card-actions">
            <button
              className="dossier-card-action"
              onClick={(event) => {
                event.stopPropagation();
                onArchive(dossier.id);
              }}
            >
              {isArchived ? 'Restaurer' : 'Archiver'}
            </button>
            <button
              className="dossier-card-action danger"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(dossier.id);
              }}
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HomeView({
  dossiers,
  model,
  onNew,
  onScrape,
  onOpen,
  onDelete,
  onDuplicate,
  onArchive,
}) {
  const stats = modelStats(model.samples, model.correctionFactor);
  const activeDossiers = dossiers.filter(dossier => !dossier.archivedAt);
  const archivedDossiers = dossiers.filter(dossier => dossier.archivedAt);

  return (
    <div className="home-view">
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
              x {stats.correctionFactor.toFixed(3)}
              <span className="model-stat-hint">
                ({stats.biasPct > 0 ? '+' : ''}{stats.biasPct}%)
              </span>
            </span>
          </div>
          <div className="model-stat model-stat-info">
            <span className="model-stat-label">Etat du modele</span>
            <span className="model-stat-value model-stat-desc">
              Mediane ponderee, ajustements contextuels et correction basee sur {stats.n} confirmation{stats.n > 1 ? 's' : ''}.
            </span>
          </div>
        </div>
      ) : (
        <div className="model-bar model-bar-cold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>
            <strong>Modele non encore calibre.</strong> Confirmez un prix reel pour enclencher la correction ML.
          </p>
        </div>
      )}

      <div className="home-hero">
        <div className="home-hero-copy">
          <span className="home-kicker">Pipeline d&apos;analyse</span>
          <h2 className="home-title">Vue portefeuille des dossiers Estimia</h2>
          <p className="home-sub">
            {activeDossiers.length === 0
              ? 'Aucun dossier actif. Lancez une nouvelle analyse ou une collecte rapide.'
              : `${activeDossiers.length} dossier${activeDossiers.length > 1 ? 's' : ''} actif${activeDossiers.length > 1 ? 's' : ''}, ${archivedDossiers.length} archive${archivedDossiers.length > 1 ? 's' : ''}.`}
          </p>
        </div>
        <div className="home-cta-btns">
          <button className="scrape-btn" onClick={onScrape}>Collecte rapide</button>
          <button className="new-btn" onClick={onNew}>Nouvelle analyse</button>
        </div>
      </div>

      {dossiers.length === 0 ? (
        <div className="home-empty-panel">
          <div className="home-empty-illustration">
            <div className="home-empty-building" />
            <div className="home-empty-circle" />
          </div>
          <div className="home-empty-grid">
            <div className="he-card">
              <div className="he-step-num">1</div>
              <h4>Collecte des donnees</h4>
              <p>Saisissez l&apos;adresse, geocodez le bien et hydratez DVF, SeLoger et le contexte quartier.</p>
            </div>
            <div className="he-card">
              <div className="he-step-num">2</div>
              <h4>Filtrage des comparables</h4>
              <p>Conservez les references pertinentes, excluez les points aberrants et reponderez au contexte local.</p>
            </div>
            <div className="he-card">
              <div className="he-step-num">3</div>
              <h4>Analyse de marche</h4>
              <p>Calculez le prix pivot, lisez la tendance et combinez les scores quartier avec votre expertise.</p>
            </div>
            <div className="he-card">
              <div className="he-step-num">4</div>
              <h4>Export et apprentissage</h4>
              <p>Generez un PDF de synthese puis confirmez le prix reel pour recalibrer le moteur.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {activeDossiers.length > 0 && (
            <section className="dossier-grid-section">
              <div className="section-heading">
                <div>
                  <h3>Dossiers actifs</h3>
                  <p>Analyses en cours, estimees ou confirmees.</p>
                </div>
              </div>
              <div className="dossier-grid">
                {activeDossiers.map(dossier => (
                  <DossierCard
                    key={dossier.id}
                    dossier={dossier}
                    onOpen={onOpen}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onArchive={onArchive}
                  />
                ))}
              </div>
            </section>
          )}

          {archivedDossiers.length > 0 && (
            <section className="dossier-grid-section archived">
              <div className="section-heading">
                <div>
                  <h3>Archives</h3>
                  <p>Dossiers sortis du flux principal mais toujours consultables.</p>
                </div>
              </div>
              <div className="dossier-grid">
                {archivedDossiers.map(dossier => (
                  <DossierCard
                    key={dossier.id}
                    dossier={dossier}
                    onOpen={onOpen}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onArchive={onArchive}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
