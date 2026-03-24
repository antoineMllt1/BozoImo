import { isoToday } from '../utils/formatters';

function dl(content, mime, name) {
  const b = new Blob(['\uFEFF' + content], { type: mime + ';charset=utf-8;' });
  const u = URL.createObjectURL(b);
  const a = Object.assign(document.createElement('a'), { href: u, download: name, style: 'display:none' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
}

export default function SelogerTable({ snapshot, onRefetch, refetching }) {
  if (!snapshot) return (
    <div className="snap-placeholder"><p>Données SeLoger non disponibles.</p></div>
  );
  if (snapshot.error) {
    return (
      <div className="snap-error-block">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>SeLoger inaccessible ou session expirée.</span>
        {onRefetch && (
          <button className="sl-refetch-btn" onClick={onRefetch} disabled={refetching}>
            {refetching ? <><span className="ws-tab-spin" /> Recherche en cours…</> : '↺ Relancer SeLoger'}
          </button>
        )}
      </div>
    );
  }

  const list = snapshot.data?.classifieds || [];

  // Detect which optional columns have at least one value
  const hasFloor    = list.some(c => c.floor       != null);
  const hasOrient   = list.some(c => c.orientation);
  const hasBedrooms = list.some(c => c.bedrooms     != null);
  const hasElevCol  = list.some(c => c.hasElevator);
  const hasBalcCol  = list.some(c => c.hasBalcony);
  const hasTerCol   = list.some(c => c.hasTerrace);
  const hasParkCol  = list.some(c => c.hasParking);
  const hasCaveCol  = list.some(c => c.hasCellar);

  const exportData = (fmt) => {
    const sep = fmt === 'csv' ? ',' : '\t';
    const q   = v => fmt === 'csv' && typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    const H   = ['#','Type','Prix','€/m²','Pièces','Chambres','Surface','Étage','Orientation',
                 'Ascenseur','Balcon','Terrasse','Parking','Cave','Ville','CP','Quartier','Agence','URL'];
    const rows = list.map((c, i) => [
      i+1, q(c.title), c.price ?? '', c.ppm2 ?? '',
      c.rooms ?? '', c.bedrooms ?? '', c.area ?? '',
      c.floor ?? '', c.orientation ?? '',
      c.hasElevator ? 'Oui' : '', c.hasBalcony ? 'Oui' : '',
      c.hasTerrace  ? 'Oui' : '', c.hasParking ? 'Oui' : '', c.hasCellar ? 'Oui' : '',
      q(c.city), c.zip, q(c.district), q(c.agency), q(c.url),
    ].join(sep));
    dl([H.join(sep), ...rows].join('\n'),
      fmt === 'csv' ? 'text/csv' : 'application/vnd.ms-excel',
      `seloger_${isoToday()}.${fmt === 'csv' ? 'csv' : 'xls'}`);
  };

  return (
    <div className="snap-section">
      <div className="snap-head">
        <div className="snap-meta">
          <span className="snap-count">{list.length}</span>
          <span className="snap-unit"> offre{list.length > 1 ? 's' : ''} collectée{list.length > 1 ? 's' : ''}</span>
          {snapshot.data?.totalCount > list.length && (
            <span className="snap-total"> · {snapshot.data.totalCount.toLocaleString('fr-FR')} sur le marché</span>
          )}
        </div>
        <div className="snap-actions">
          <button className="exp-btn" onClick={() => exportData('csv')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>CSV
          </button>
          <button className="exp-btn" onClick={() => exportData('xls')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>Excel
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <span>🔍</span>
          <p>Aucune offre collectée — élargissez la zone ou ajustez les filtres.</p>
          {onRefetch && (
            <button className="sl-refetch-btn" onClick={onRefetch} disabled={refetching}>
              {refetching ? <><span className="ws-tab-spin" /> Recherche en cours…</> : '↺ Relancer la recherche SeLoger'}
            </button>
          )}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Localisation</th>
                <th>Pièces</th>
                {hasBedrooms && <th>Ch.</th>}
                <th>Surface m²</th>
                <th>Prix</th>
                <th>€/m²</th>
                {hasFloor   && <th>Ét.</th>}
                {hasOrient  && <th>Orient.</th>}
                {hasElevCol && <th title="Ascenseur">🛗</th>}
                {hasBalcCol && <th title="Balcon">🌿</th>}
                {hasTerCol  && <th title="Terrasse">☀️</th>}
                {hasParkCol && <th title="Parking">🚗</th>}
                {hasCaveCol && <th title="Cave">🏚️</th>}
                <th>Agence</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c, i) => {
                const isAppt = c.title?.toLowerCase().includes('appartement');
                const loc    = [c.district, c.city && c.zip ? `${c.city} (${c.zip})` : c.city].filter(Boolean).join(', ');
                return (
                  <tr key={i}>
                    <td className="td-n">{i + 1}</td>
                    <td className="td-type"><span>{isAppt ? '🏢' : '🏠'}</span>{c.title}</td>
                    <td className="td-addr">{loc || '—'}</td>
                    <td className="td-c">{c.rooms ?? '—'}</td>
                    {hasBedrooms && <td className="td-c">{c.bedrooms ?? '—'}</td>}
                    <td className="td-c">{c.area ?? '—'}</td>
                    <td className="td-price">{c.price != null ? c.price.toLocaleString('fr-FR') + ' €' : '—'}</td>
                    <td className="td-ppm">{c.ppm2 != null ? c.ppm2.toLocaleString('fr-FR') : '—'}</td>
                    {hasFloor   && <td className="td-c">{c.floor   ?? '—'}</td>}
                    {hasOrient  && <td className="td-c">{c.orientation ?? '—'}</td>}
                    {hasElevCol && <td className="td-c">{c.hasElevator ? '✓' : ''}</td>}
                    {hasBalcCol && <td className="td-c">{c.hasBalcony  ? '✓' : ''}</td>}
                    {hasTerCol  && <td className="td-c">{c.hasTerrace  ? '✓' : ''}</td>}
                    {hasParkCol && <td className="td-c">{c.hasParking  ? '✓' : ''}</td>}
                    {hasCaveCol && <td className="td-c">{c.hasCellar   ? '✓' : ''}</td>}
                    <td className="td-agency">{c.agency || '—'}</td>
                    <td>
                      {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="view-link">Voir →</a>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
