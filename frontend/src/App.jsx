import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import './styles/additions.css';
import { loadDossiers, saveDossiers, loadModel } from './utils/storage';
import { saveModel } from './utils/storage';
import { computeEstimate, computeEstimateFromRefs, modelStats } from './utils/model';
import { normalizeRefs, applyFilters } from './utils/edm';
import { normalizeDossier } from './utils/dossiers';
import { fmtPm2 } from './utils/formatters';
import HomeView from './components/HomeView';
import CommandPalette from './components/CommandPalette';

const NewDossierForm = lazy(() => import('./components/NewDossierForm'));
const DossierView = lazy(() => import('./components/DossierView'));
const ScrapeView = lazy(() => import('./components/ScrapeView'));

const UI_PREFS_KEY = 'estimia_ui_prefs_v2';

function readUiPrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_PREFS_KEY) || '{}');
    return {
      density: ['compact', 'regular', 'comfortable'].includes(parsed.density) ? parsed.density : 'regular',
      sidebarCollapsed: parsed.sidebarCollapsed === true,
    };
  } catch {
    return { density: 'regular', sidebarCollapsed: false };
  }
}

function makeId(prefix = 'dossier') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function deriveActiveStatus(dossier) {
  if (dossier.confirmed) return 'confirmed';
  if (dossier.manualEstimate || dossier.prixPivot) return 'estimated';
  if ((dossier.analystFilters && Object.values(dossier.analystFilters).some(Boolean)) || Object.keys(dossier.analystExclusions || {}).length) {
    return 'in_progress';
  }
  return 'draft';
}

function hydrateEstimate(dossier, correctionFactor) {
  const normalized = normalizeDossier({
    ...dossier,
    updatedAt: dossier.updatedAt || new Date().toISOString(),
  });

  const allRefs = normalizeRefs(normalized.dvfSnapshot, normalized.selogerSnapshot, 0.05);
  const refs = allRefs.map(ref => ({ ...ref, excluded: normalized.analystExclusions?.[ref.id] || false }));
  const filteredRefs = applyFilters(refs, normalized.analystFilters || {}, normalized.target?.type || null);

  const lastEstimate = filteredRefs.length > 0
    ? computeEstimateFromRefs(
        filteredRefs,
        normalized.target,
        correctionFactor,
        normalized.areaContext || null,
        { lat: normalized.lat, lng: normalized.lng }
      )
    : computeEstimate(
        normalized.dvfSnapshot?.data?.features || [],
        normalized.selectedComps || [],
        normalized.target,
        correctionFactor,
        normalized.areaContext || null,
        { lat: normalized.lat, lng: normalized.lng }
      );

  return normalizeDossier({ ...normalized, lastEstimate });
}

export default function App() {
  const uiPrefs = useMemo(() => readUiPrefs(), []);
  const [view, setView] = useState('home');
  const [dossiers, setDossiers] = useState(() => loadDossiers());
  const [activeDossierId, setActiveDossierId] = useState(null);
  const [model, setModel] = useState(loadModel);
  const [density, setDensity] = useState(uiPrefs.density);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(uiPrefs.sidebarCollapsed);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const result = saveDossiers(dossiers);
    if (result?.error === 'quota') {
      console.warn('localStorage quota reached. Consider removing large photos or old dossiers.');
    }
  }, [dossiers]);

  useEffect(() => {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ density, sidebarCollapsed }));
  }, [density, sidebarCollapsed]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const orderedDossiers = useMemo(
    () => [...dossiers].sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt)),
    [dossiers]
  );

  const activeDossier = orderedDossiers.find(dossier => dossier.id === activeDossierId) || null;
  const stats = modelStats(model.samples, model.correctionFactor);

  const handleCreated = useCallback((dossier) => {
    const now = new Date().toISOString();
    const hydrated = hydrateEstimate(
      {
        ...dossier,
        id: dossier.id || makeId(),
        createdAt: dossier.createdAt || now,
        updatedAt: now,
        status: dossier.status || 'draft',
      },
      model.correctionFactor
    );
    setDossiers(prev => [hydrated, ...prev]);
    setActiveDossierId(hydrated.id);
    setView('dossier');
  }, [model.correctionFactor]);

  const handleUpdate = useCallback((updated) => {
    const hydrated = hydrateEstimate(
      {
        ...updated,
        updatedAt: new Date().toISOString(),
      },
      model.correctionFactor
    );
    setDossiers(prev => prev.map(dossier => (dossier.id === hydrated.id ? hydrated : dossier)));
  }, [model.correctionFactor]);

  const handleConfirmPrice = useCallback((updatedModel) => {
    saveModel(updatedModel);
    setModel(updatedModel);
  }, []);

  const handleOpen = useCallback((id) => {
    setActiveDossierId(id);
    setView('dossier');
    setCommandOpen(false);
  }, []);

  const handleDelete = useCallback((id) => {
    if (!window.confirm('Supprimer ce dossier ?')) return;
    setDossiers(prev => prev.filter(dossier => dossier.id !== id));
    if (activeDossierId === id) {
      setActiveDossierId(null);
      setView('home');
    }
  }, [activeDossierId]);

  const handleDuplicate = useCallback((id) => {
    const source = dossiers.find(dossier => dossier.id === id);
    if (!source) return;
    const now = new Date().toISOString();
    const duplicated = hydrateEstimate({
      ...source,
      id: makeId('copy'),
      address: `${source.address} (copie)`,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      status: 'draft',
      confirmed: null,
    }, model.correctionFactor);
    setDossiers(prev => [duplicated, ...prev]);
    setActiveDossierId(duplicated.id);
    setView('dossier');
  }, [dossiers, model.correctionFactor]);

  const handleArchive = useCallback((id) => {
    setDossiers(prev => prev.map(dossier => {
      if (dossier.id !== id) return dossier;
      const archived = !dossier.archivedAt;
      return normalizeDossier({
        ...dossier,
        archivedAt: archived ? new Date().toISOString() : null,
        status: archived ? 'archived' : deriveActiveStatus(dossier),
        updatedAt: new Date().toISOString(),
      });
    }));
  }, []);

  const handleBack = useCallback(() => {
    setView('home');
  }, []);

  const handleCommand = useCallback((payload) => {
    if (payload.type === 'home') {
      setView('home');
      setCommandOpen(false);
      return;
    }
    if (payload.type === 'new') {
      setView('new');
      setCommandOpen(false);
      return;
    }
    if (payload.type === 'scrape') {
      setView('scrape');
      setCommandOpen(false);
      return;
    }
    if (payload.type === 'density') {
      setDensity(payload.value);
      setCommandOpen(false);
      return;
    }
    if (payload.type === 'toggle_sidebar') {
      setSidebarCollapsed(current => !current);
      setCommandOpen(false);
      return;
    }
    if (payload.type === 'open_dossier' && payload.dossierId) {
      handleOpen(payload.dossierId);
    }
  }, [handleOpen]);

  const topbarRight = (
    <div className="topbar-right">
      <div className="density-switch" role="group" aria-label="Densite">
        {[
          ['compact', 'Compact'],
          ['regular', 'Regulier'],
          ['comfortable', 'Confort'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`density-btn ${density === value ? 'active' : ''}`}
            onClick={() => setDensity(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <button className="topbar-btn" onClick={() => setCommandOpen(true)}>
        Cmd+K
      </button>
      {view === 'home' && (
        <>
          <button className="topbar-btn" onClick={() => setView('scrape')}>Collecte rapide</button>
          <button className="topbar-btn topbar-btn-primary" onClick={() => setView('new')}>Nouvelle analyse</button>
        </>
      )}
      {view === 'dossier' && activeDossier && (
        <>
          <button className="topbar-btn" onClick={() => handleDuplicate(activeDossier.id)}>Dupliquer</button>
          <button className="topbar-btn" onClick={() => handleArchive(activeDossier.id)}>
            {activeDossier.archivedAt ? 'Restaurer' : 'Archiver'}
          </button>
          <button className="topbar-btn" onClick={() => handleDelete(activeDossier.id)}>Supprimer</button>
        </>
      )}
    </div>
  );

  return (
    <div className={`app app-density-${density} ${sidebarCollapsed ? 'app-sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="sb-logo-mark">E</div>
          <div className="sb-logo-text">
            <span className="sb-logo-name">Estimia</span>
            <span className="sb-logo-tag">Analyse immobiliere</span>
          </div>
          <button className="sb-collapse-btn" onClick={() => setSidebarCollapsed(current => !current)} title="Basculer la barre laterale">
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sb-nav">
          <span className="sb-section-label">Navigation</span>
          <button className={`sb-item ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="sb-item-copy">Accueil</span>
            {orderedDossiers.length > 0 && <span className="sb-item-badge">{orderedDossiers.length}</span>}
          </button>
          <button className={`sb-item ${view === 'scrape' ? 'active' : ''}`} onClick={() => setView('scrape')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="sb-item-copy">Collecte</span>
          </button>

          <span className="sb-section-label">Dossiers recents</span>
          {orderedDossiers.filter(dossier => !dossier.archivedAt).slice(0, 6).map(dossier => (
            <button
              key={dossier.id}
              className={`sb-item ${view === 'dossier' && activeDossierId === dossier.id ? 'active' : ''}`}
              onClick={() => handleOpen(dossier.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="sb-item-copy sb-item-label">{dossier.address}</span>
            </button>
          ))}
        </nav>

        <button className="sb-new-btn" onClick={() => setView('new')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Nouvelle analyse</span>
        </button>

        <div className="sb-model-box">
          <div className="sb-model-title">Modele ML</div>
          {stats ? (
            <>
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
                  x {stats.correctionFactor.toFixed(3)}
                </span>
              </div>
            </>
          ) : (
            <p className="sb-cold">Non calibre. Une confirmation suffit pour l&apos;amorcer.</p>
          )}
        </div>

        <div className="sb-footer">
          DVF, SeLoger et enrichissements quartier
          <br />
          Commande rapide: Cmd+K
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            {view === 'home' && <span className="topbar-title">Portefeuille d&apos;analyses</span>}
            {view === 'new' && (
              <nav className="topbar-breadcrumb">
                <button className="topbar-crumb-link" onClick={() => setView('home')}>Accueil</button>
                <span className="topbar-crumb-current">Nouvelle analyse</span>
              </nav>
            )}
            {view === 'scrape' && (
              <nav className="topbar-breadcrumb">
                <button className="topbar-crumb-link" onClick={() => setView('home')}>Accueil</button>
                <span className="topbar-crumb-current">Collecte rapide</span>
              </nav>
            )}
            {view === 'dossier' && activeDossier && (
              <nav className="topbar-breadcrumb">
                <button className="topbar-crumb-link" onClick={() => setView('home')}>Accueil</button>
                <span className="topbar-crumb-current">{activeDossier.address}</span>
              </nav>
            )}
          </div>
          {topbarRight}
        </div>

        <div className="page-content">
          <Suspense fallback={
            <div className="state-loading">
              <div className="spinner-ring" />
              <p>Chargement...</p>
            </div>
          }>
            {view === 'home' && (
              <HomeView
                dossiers={orderedDossiers}
                model={model}
                onNew={() => setView('new')}
                onScrape={() => setView('scrape')}
                onOpen={handleOpen}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onArchive={handleArchive}
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

            {view === 'scrape' && <ScrapeView onBack={handleBack} />}

            {view === 'dossier' && !activeDossier && (
              <div className="state-loading">
                <div className="spinner-ring" />
                <p>Chargement du dossier...</p>
              </div>
            )}
          </Suspense>
        </div>
      </div>

      {commandOpen && (
        <CommandPalette
          dossiers={orderedDossiers}
          onClose={() => setCommandOpen(false)}
          onCommand={handleCommand}
        />
      )}
    </div>
  );
}
