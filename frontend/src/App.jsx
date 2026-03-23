import { useState, useEffect, useCallback } from 'react';
import './App.css';
import './styles/additions.css';
import { loadDossiers, saveDossiers, loadModel } from './utils/storage';
import { computeEstimate } from './utils/model';
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
      // Recompute and cache lastEstimate
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* Navbar — always visible */}
      <header className="navbar">
        <div className="nav-inner">
          <a className="nav-logo" href="/"
            onClick={e => { e.preventDefault(); setView('home'); }}>
            <div className="logo-mark">E</div>
            <div className="logo-text">
              <span className="logo-name">Estimia</span>
              <span className="logo-tagline">Analyse du marché immobilier</span>
            </div>
          </a>
          <div className="nav-right">
            {view !== 'home' && (
              <button className="nav-link" onClick={() => setView('home')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                Accueil
              </button>
            )}
            {view === 'home' && (
              <>
                <button className="nav-link nav-scrape-btn" onClick={() => setView('scrape')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Collecte rapide
                </button>
                <button className="search-btn nav-new-btn" onClick={() => setView('new')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Nouvelle analyse
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* View */}
      <main className="main-content">
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
      </main>

      <footer className="footer">
        Données issues de SeLoger &amp; MeilleursAgents · Usage analytique uniquement · Non affilié
      </footer>
    </div>
  );
}
