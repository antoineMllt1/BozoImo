import { isoToday } from '../utils/formatters';
import { inferPropertyType, matchesTargetPropertyType } from '../utils/propertyType';

function dl(content, mime, name) {
  const blob = new Blob(['\uFEFF' + content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement('a'), { href: url, download: name, style: 'display:none' });
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function SelogerTable({
  snapshot,
  onRefetch,
  refetching,
  hoveredRefId = null,
  onHoverRef = null,
  targetType = null,
}) {
  if (!snapshot) {
    return (
      <div className="snap-placeholder"><p>Données SeLoger non disponibles.</p></div>
    );
  }

  if (snapshot.error) {
    return (
      <div className="snap-error-block">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>SeLoger inaccessible ou session expirée.</span>
        {onRefetch && (
          <button className="sl-refetch-btn" onClick={onRefetch} disabled={refetching}>
            {refetching ? <><span className="ws-tab-spin" /> Recherche en cours…</> : '↻ Relancer SeLoger'}
          </button>
        )}
      </div>
    );
  }

  const rawList = (snapshot.data?.classifieds || []).map((item, index) => ({ ...item, __refId: `sl_${index}` }));
  const list = targetType ? rawList.filter(item => matchesTargetPropertyType(item, targetType)) : rawList;

  const hasFloor = list.some(item => item.floor != null);
  const hasOrient = list.some(item => item.orientation);
  const hasBedrooms = list.some(item => item.bedrooms != null);
  const hasElevCol = list.some(item => item.hasElevator);
  const hasBalcCol = list.some(item => item.hasBalcony);
  const hasTerCol = list.some(item => item.hasTerrace);
  const hasParkCol = list.some(item => item.hasParking);
  const hasCaveCol = list.some(item => item.hasCellar);

  const exportData = (fmt) => {
    const sep = fmt === 'csv' ? ',' : '\t';
    const q = value => fmt === 'csv' && typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
    const headers = [
      '#', 'Type', 'Prix', '€/m²', 'Pièces', 'Chambres', 'Surface', 'Étage', 'Orientation',
      'Ascenseur', 'Balcon', 'Terrasse', 'Parking', 'Cave', 'Ville', 'CP', 'Quartier', 'Agence', 'URL',
    ];
    const rows = list.map((item, index) => [
      index + 1,
      q(item.title),
      item.price ?? '',
      item.ppm2 ?? '',
      item.rooms ?? '',
      item.bedrooms ?? '',
      item.area ?? '',
      item.floor ?? '',
      item.orientation ?? '',
      item.hasElevator ? 'Oui' : '',
      item.hasBalcony ? 'Oui' : '',
      item.hasTerrace ? 'Oui' : '',
      item.hasParking ? 'Oui' : '',
      item.hasCellar ? 'Oui' : '',
      q(item.city),
      item.zip,
      q(item.district),
      q(item.agency),
      q(item.url),
    ].join(sep));

    dl(
      [headers.join(sep), ...rows].join('\n'),
      fmt === 'csv' ? 'text/csv' : 'application/vnd.ms-excel',
      `seloger_${isoToday()}.${fmt === 'csv' ? 'csv' : 'xls'}`
    );
  };

  return (
    <div className="snap-section">
      <div className="snap-head">
        <div className="snap-meta">
          <span className="snap-count">{list.length}</span>
          <span className="snap-unit"> offre{list.length > 1 ? 's' : ''} collectée{list.length > 1 ? 's' : ''}</span>
          {snapshot.data?.totalCount > rawList.length && (
            <span className="snap-total"> · {snapshot.data.totalCount.toLocaleString('fr-FR')} sur le marché</span>
          )}
        </div>
        <div className="snap-actions">
          <button className="exp-btn" onClick={() => exportData('csv')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV
          </button>
          <button className="exp-btn" onClick={() => exportData('xls')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Excel
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <span>🔍</span>
          <p>Aucune offre collectée pour ce type de bien. Élargissez la zone ou relancez la collecte.</p>
          {onRefetch && (
            <button className="sl-refetch-btn" onClick={onRefetch} disabled={refetching}>
              {refetching ? <><span className="ws-tab-spin" /> Recherche en cours…</> : '↻ Relancer la recherche SeLoger'}
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
                {hasFloor && <th>Ét.</th>}
                {hasOrient && <th>Orient.</th>}
                {hasElevCol && <th title="Ascenseur">🛗</th>}
                {hasBalcCol && <th title="Balcon">🌿</th>}
                {hasTerCol && <th title="Terrasse">☀️</th>}
                {hasParkCol && <th title="Parking">🚗</th>}
                {hasCaveCol && <th title="Cave">🏚️</th>}
                <th>Agence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((item, index) => {
                const isApartment = inferPropertyType(item.propertyType, item.title, item.keywords) === 'Apartment';
                const location = [item.district, item.city && item.zip ? `${item.city} (${item.zip})` : item.city].filter(Boolean).join(', ');
                return (
                  <tr
                    key={item.url || index}
                    className={hoveredRefId === item.__refId ? 'ref-hovered' : ''}
                    onMouseEnter={() => onHoverRef?.(item.__refId)}
                    onMouseLeave={() => onHoverRef?.(null)}
                  >
                    <td className="td-n">{index + 1}</td>
                    <td className="td-type"><span>{isApartment ? '🏢' : '🏠'}</span>{item.title}</td>
                    <td className="td-addr">{location || '—'}</td>
                    <td className="td-c">{item.rooms ?? '—'}</td>
                    {hasBedrooms && <td className="td-c">{item.bedrooms ?? '—'}</td>}
                    <td className="td-c">{item.area ?? '—'}</td>
                    <td className="td-price">{item.price != null ? `${item.price.toLocaleString('fr-FR')} €` : '—'}</td>
                    <td className="td-ppm">{item.ppm2 != null ? item.ppm2.toLocaleString('fr-FR') : '—'}</td>
                    {hasFloor && <td className="td-c">{item.floor ?? '—'}</td>}
                    {hasOrient && <td className="td-c">{item.orientation ?? '—'}</td>}
                    {hasElevCol && <td className="td-c">{item.hasElevator ? '✓' : ''}</td>}
                    {hasBalcCol && <td className="td-c">{item.hasBalcony ? '✓' : ''}</td>}
                    {hasTerCol && <td className="td-c">{item.hasTerrace ? '✓' : ''}</td>}
                    {hasParkCol && <td className="td-c">{item.hasParking ? '✓' : ''}</td>}
                    {hasCaveCol && <td className="td-c">{item.hasCellar ? '✓' : ''}</td>}
                    <td className="td-agency">{item.agency || '—'}</td>
                    <td>
                      {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="view-link">Voir →</a>}
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
