import { useEffect, useMemo, useState } from 'react';

function matchesQuery(text, query) {
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

export default function CommandPalette({
  dossiers = [],
  onClose,
  onCommand,
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(() => {
    const actions = [
      { id: 'go_home', label: 'Accueil', hint: 'Retour a la liste des dossiers', type: 'action', payload: { type: 'home' } },
      { id: 'new_dossier', label: 'Nouvelle analyse', hint: 'Creer un nouveau dossier', type: 'action', payload: { type: 'new' } },
      { id: 'quick_collect', label: 'Collecte rapide', hint: 'Lancer une collecte seule', type: 'action', payload: { type: 'scrape' } },
      { id: 'density_compact', label: 'Densite compacte', hint: 'Tables plus serrees', type: 'action', payload: { type: 'density', value: 'compact' } },
      { id: 'density_regular', label: 'Densite reguliere', hint: 'Densite par defaut', type: 'action', payload: { type: 'density', value: 'regular' } },
      { id: 'density_comfort', label: 'Densite confortable', hint: 'Espacement plus aere', type: 'action', payload: { type: 'density', value: 'comfortable' } },
      { id: 'toggle_sidebar', label: 'Basculer la barre laterale', hint: 'Mode compact ou etendu', type: 'action', payload: { type: 'toggle_sidebar' } },
    ];

    const dossierItems = dossiers.map(dossier => ({
      id: dossier.id,
      label: dossier.address || 'Dossier sans adresse',
      hint: dossier.archivedAt ? 'Archive' : dossier.status || 'draft',
      type: 'dossier',
      payload: { type: 'open_dossier', dossierId: dossier.id },
    }));

    return [...actions, ...dossierItems].filter(item =>
      matchesQuery(`${item.label} ${item.hint}`, query)
    );
  }, [dossiers, query]);

  const safeActiveIndex = items.length ? Math.min(activeIndex, items.length - 1) : 0;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex(current => (items.length ? (current + 1) % items.length : 0));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex(current => (items.length ? (current - 1 + items.length) % items.length : 0));
        return;
      }
      if (event.key === 'Enter' && items[safeActiveIndex]) {
        event.preventDefault();
        onCommand(items[safeActiveIndex].payload);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, onClose, onCommand, safeActiveIndex]);

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={event => event.stopPropagation()}>
        <div className="command-palette-head">
          <input
            autoFocus
            className="command-palette-input"
            placeholder="Rechercher un dossier ou une action..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
          />
          <span className="command-palette-kbd">Esc</span>
        </div>

        <div className="command-palette-list">
          {!items.length && (
            <div className="command-palette-empty">
              Aucun resultat pour <strong>{query}</strong>.
            </div>
          )}

          {items.map((item, index) => (
            <button
              key={item.id}
              className={`command-palette-item ${index === safeActiveIndex ? 'active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onCommand(item.payload)}
            >
              <div>
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </div>
              <span className="command-palette-type">{item.type === 'dossier' ? 'Dossier' : 'Action'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
