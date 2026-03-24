import { useState, useEffect, useCallback } from 'react';
import './App.css';
import './styles/additions.css';
import { loadDossiers, saveDossiers, loadModel } from './utils/storage';
import { computeEstimate } from './utils/model';
import { modelStats } from './utils/model';
import { fmtPm2 } from './utils/formatters';
import HomeView       from './components/HomeView';
import NewDossierForm from './components/NewDossierForm';
import DossierView    from './components/DossierView';
import ScrapeView     from './components/ScrapeView';

export default function App() {
  const [view,            setView]            = useState('home');
  const [dossiers,        setDossiers]        = useState([]);
  const [activeDossierId, setActiveDossierId] = useState(null);
  const [model,           setModel]           = useState(loadModel);

  // Load dossiers from localStorage on mount
  useEffect(() => { setDossiers(loadDossiers()); }, []);

  // Persist dossiers on every change
  useEffect(() => {
    const result = saveDossiers(dossiers);
    if (result && result.error === 'quota') {
      // eslint-disable-next-line no-console
      console.warn('localStorage quota atteint — supprimez des anciens dossiers.');
    }
  }, [dossiers]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreated = useCallback((dossier) => {
    setDossiers(prev => [dossier, ...prev]);
    setActiveDossierId(dossier.id);
    setView('dossier');
  }, []);

  const handleUpdate = useCallback((updated) => {
    setDossiers(prev => prev.map(d => {
      if (d.id !== updated.id) return d;
      const features = updated.dvfSnapshot?.data?.features || [];
      const lastEstimate = computeEstimate(
        features,
        updated.selectedComps,
        updated.target,
        model.correctionFactor
      );
      return { ...updated, lastEstimate };
    }));
  }, [model.correctionFactor]);

  const handleConfirmPrice = useCallback((updatedModel) => {
    setModel(updatedModel);
  }, []);

  const handleOpen = useCallback((id) => {
    setActiveDossierId(id);
    setView('dossier');
  }, []);

  const handleDelete = useCallback((id) => {
    if (!window.confirm('Supprimer ce dossier ?')) return;
    setDossiers(prev => prev.filter(d => d.id !== id));
    if (activeDossierId === id) setActiveDossierId(null);
  }, [activeDossierId]);

  const handleBack = useCallback(() => {
    setView('home');
  }, []);

  const activeDossier = dossiers.find(d => d.id === activeDossierId);
  const stats = modelStats(model.samples, model.correctionFactor);

  // ── Topbar content per view ───────────────────────────────────────────────

  const topbarContent = () => {
    if (view === 'home') return (
      <>
        <div className="topbar-left">
          <span className="topbar-title">Dossiers d&apos;analyse</span>
        </div>
        <div className="topbar-right">
          <button className="topbar-btn" onClick={() => setView('scrape')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Collecte rapide
          </button>
          <button className="topbar-btn topbar-btn-primary" onClick={() => setView('new')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nouvelle analyse
          </button>
        </div>
      </>
    );

    if (view === 'new') return (
      <>
        <div className="topbar-left">
          <nav className="topbar-breadcrumb">
            <button className="topbar-crumb-link" onClick={() => setView('home')}>Accueil</button>
            <svg className="topbar-crumb-sep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span className="topbar-crumb-current">Nouvelle analyse</span>
          </nav>
        </div>
        <div className="topbar-right" />
      </>
    );

    if (view === 'scrape') return (
      <>
        <div className="topbar-left">
          <nav className="topbar-breadcrumb">
            <button className="topbar-crumb-link" onClick={() => setView('home')}>Accueil</button>
            <svg className="topbar-crumb-sep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span className="topbar-crumb-current">Collecte rapide</span>
          </nav>
        </div>
        <div className="topbar-right" />
      </>
    );

    if (view === 'dossier' && activeDossier) return (
      <>
        <div className="topbar-left">
          <nav className="topbar-breadcrumb">
            <button className="topbar-crumb-link" onClick={() => setView('home')}>Accueil</button>
            <svg className="topbar-crumb-sep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span className="topbar-crumb-current topbar-title">{activeDossier.address}</span>
          </nav>
        </div>
        <div className="topbar-right">
          <button className="topbar-btn" onClick={() => handleDelete(activeDossier.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Supprimer
          </button>
        </div>
      </>
    );

    return <div className="topbar-left" />;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="sb-logo-mark">E</div>
          <div className="sb-logo-text">
            <span className="sb-logo-name">Estimia</span>
            <span className="sb-logo-tag">Analyse immobilière</span>
          </div>
        </div>

        <nav className="sb-nav">
          <span className="sb-section-label">Navigation</span>
          <button
            className={`sb-item ${view === 'home' ? 'active' : ''}`}
            onClick={() => setView('home')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Accueil
            {dossiers.length > 0 && (
              <span className="sb-item-badge">{dossiers.length}</span>
            )}
          </button>
          <button
            className={`sb-item ${view === 'scrape' ? 'active' : ''}`}
            onClick={() => setView('scrape')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Collecte rapide
          </button>

          <span className="sb-section-label" style={{ marginTop: 8 }}>Dossiers récents</span>
          {dossiers.slice(0, 5).map(d => (
            <button
              key={d.id}
              className={`sb-item ${view === 'dossier' && activeDossierId === d.id ? 'active' : ''}`}
              onClick={() => handleOpen(d.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.address}
              </span>
            </button>
          ))}
        </nav>

        <button className="sb-new-btn" onClick={() => setView('new')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouvelle analyse
        </button>

        {stats ? (
          <div className="sb-model-box">
            <div className="sb-model-title">Modèle ML</div>
            <div className="sb-model-row">
              <span>Confirmations</span>
              <span className="sb-model-val">{stats.n}</span>
            </div>
            <div className="sb-model-row">
              <span>Erreur moy.</span>
              <span className="sb-model-val">{fmtPm2(stats.mae)}</span>
            </div>
            <div className="sb-model-row">
              <span>Facteur</span>
              <span className={`sb-model-val ${stats.biasPct > 2 ? 'up' : stats.biasPct < -2 ? 'down' : ''}`}>
                × {stats.correctionFactor.toFixed(3)}
              </span>
            </div>
          </div>
        ) : (
          <div className="sb-model-box">
            <div className="sb-model-title">Modèle ML</div>
            <p className="sb-cold">Non calibré — confirmez une estimation pour démarrer.</p>
          </div>
        )}

        <div className="sb-footer">
          Données SeLoger &amp; DVF<br />
          Usage analytique uniquement
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        <div className="topbar">
          {topbarContent()}
        </div>

        <div className="page-content">
          {view === 'home' && (
            <HomeView
              dossiers={dossiers}
              model={model}
              onNew={() => setView('new')}
              onScrape={() => setView('scrape')}
              onOpen={handleOpen}
              onDelete={handleDelete}
            />
          )}
          {view === 'new' && (
            <NewDossierForm
              onCreated={handleCreated}
              onBack={handleBack}
            />
          )}
          {view === 'dossier' && activeDossier && (
            <DossierView
              dossier={activeDossier}
              model={model}
              onUpdate={handleUpdate}
              onConfirmPrice={handleConfirmPrice}
              onBack={handleBack}
            />
          )}
          {view === 'scrape' && (
            <ScrapeView onBack={handleBack} />
          )}
          {view === 'dossier' && !activeDossier && (
            <div className="state-loading">
              <div className="spinner-ring" />
              <p>Chargement du dossier…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
