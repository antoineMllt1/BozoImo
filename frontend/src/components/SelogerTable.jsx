import { isoToday, extractKf } from '../utils/formatters';

function dl(content, mime, name) {
  const b = new Blob(['\uFEFF' + content], { type: mime + ';charset=utf-8;' });
  const u = URL.createObjectURL(b);
  const a = Object.assign(document.createElement('a'), { href: u, download: name, style: 'display:none' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
}

// Safely convert any value to a lowercase string, returns '' for non-strings
function toStr(v) {
  if (typeof v === 'string') return v.toLowerCase();
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && typeof v.value === 'string') return v.value.toLowerCase();
  return '';
}

// Extract structured property info from a classified object
function parseClassified(c) {
  // Normalise keyfacts: keep only non-empty strings
  const rawKf = Array.isArray(c.hardFacts?.keyfacts) ? c.hardFacts.keyfacts : [];
  const kf = rawKf.map(toStr).filter(Boolean);

  // Tags from various possible fields
  const rawTags = Array.isArray(c.tags) ? c.tags
    : Array.isArray(c.features) ? c.features
    : [];
  const tags = rawTags.map(toStr).filter(Boolean);

  const all = [...kf, ...tags];

  // Floor — "Étage 3", "3ème étage", "3e étage"
  let floor = null;
  for (const k of all) {
    const m = k.match(/[ée]tage\s+(\d+)/) || k.match(/^(\d+)\s*(?:er|ère|ème|e)\s+[ée]tage/);
    if (m) { floor = parseInt(m[1], 10); break; }
  }

  // Orientation
  const orientMap = {
    'sud-ouest': 'SW', 'sud-est': 'SE', 'nord-ouest': 'NW', 'nord-est': 'NE',
    'south-west': 'SW', 'south-east': 'SE', 'north-west': 'NW', 'north-east': 'NE',
    nord: 'N', sud: 'S', est: 'E', ouest: 'W',
    north: 'N', south: 'S', east: 'E', west: 'W',
  };
  let orientation = null;
  outer: for (const k of all) {
    for (const [word, code] of Object.entries(orientMap)) {
      if (k.includes(word)) { orientation = code; break outer; }
    }
  }

  // Boolean amenities
  const has = (...words) => all.some(k => words.some(w => k.includes(w)));

  return {
    floor,
    orientation,
    hasElevator: has('ascenseur', 'elevator') ? true : null,
    hasBalcony:  has('balcon', 'balcony')     ? true : null,
    hasTerrace:  has('terrasse', 'terrace')   ? true : null,
    hasParking:  has('parking', 'garage', 'box') ? true : null,
    hasCellar:   has('cave', 'cellar')        ? true : null,
  };
}

export default function SelogerTable({ snapshot }) {
  if (!snapshot) return (
    <div className="snap-placeholder">
      <p>Données SeLoger non disponibles.</p>
    </div>
  );
  if (snapshot.error) return (
    <div className="snap-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>Erreur : {snapshot.error}</span>
    </div>
  );

  const list = snapshot.data?.classifieds || [];

  const exportData = (fmt) => {
    const sep = fmt === 'csv' ? ',' : '\t';
    const q   = v => fmt === 'csv' && typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    const H   = ['#','Type','Prix','€/m²','Pièces','Chambres','Surface','Étage','Orientation','Ascenseur','Balcon','Terrasse','Parking','Cave','Ville','CP','Quartier','Agence','Note','URL'];
    const rows = list.map((c, i) => {
      const kf = c.hardFacts?.keyfacts || [];
      const info = parseClassified(c);
      return [i+1, q(c.hardFacts?.title||''), q(c.hardFacts?.price?.value||''),
        c.hardFacts?.price?.additionalInformation||'',
        extractKf(kf,'pièce'), extractKf(kf,'chambre'), extractKf(kf,'m²'),
        info.floor ?? '', info.orientation ?? '',
        info.hasElevator ? 'Oui' : '', info.hasBalcony ? 'Oui' : '',
        info.hasTerrace ? 'Oui' : '', info.hasParking ? 'Oui' : '', info.hasCellar ? 'Oui' : '',
        q(c.location?.address?.city||''), c.location?.address?.zipCode||'',
        q(c.location?.address?.district||''), q(c.provider?.intermediaryCard?.title||''),
        c.provider?.rating?.rating||'', q(c.url||'')].join(sep);
    });
    dl([H.join(sep), ...rows].join('\n'),
      fmt==='csv'?'text/csv':'application/vnd.ms-excel',
      `seloger_${isoToday()}.${fmt==='csv'?'csv':'xls'}`);
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
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Type</th><th>Prix</th><th>€/m²</th>
                <th>Keyfacts</th><th>Bien</th><th>Localisation</th><th>Agence</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c, i) => {
                const kf   = c.hardFacts?.keyfacts || [];
                const loc  = c.location?.address   || {};
                const info = parseClassified(c);
                const isAppt = c.hardFacts?.title?.toLowerCase().includes('appartement');
                return (
                  <tr key={c.id || i}>
                    <td className="td-n">{i + 1}</td>
                    <td className="td-type"><span>{isAppt ? '🏢' : '🏠'}</span>{c.hardFacts?.title}</td>
                    <td className="td-price">{c.hardFacts?.price?.value}</td>
                    <td className="td-ppm">{c.hardFacts?.price?.additionalInformation}</td>
                    <td>
                      <div className="kf-wrap">
                        {kf.map((f, j) => <span key={j} className="kf-tag">{f}</span>)}
                      </div>
                    </td>
                    <td>
                      <div className="prop-tags">
                        {info.floor != null && (
                          <span className="prop-tag">Ét. {info.floor}</span>
                        )}
                        {info.orientation && (
                          <span className="prop-tag prop-tag-orient">{info.orientation}</span>
                        )}
                        {info.hasElevator && <span className="prop-tag prop-tag-yes" title="Ascenseur">🛗</span>}
                        {info.hasBalcony  && <span className="prop-tag prop-tag-yes" title="Balcon">🌿</span>}
                        {info.hasTerrace  && <span className="prop-tag prop-tag-yes" title="Terrasse">☀️</span>}
                        {info.hasParking  && <span className="prop-tag prop-tag-yes" title="Parking">🚗</span>}
                        {info.hasCellar   && <span className="prop-tag prop-tag-yes" title="Cave">🏚️</span>}
                      </div>
                    </td>
                    <td>
                      {loc.district && <div className="td-district">{loc.district}</div>}
                      <div className="td-city">{loc.city}{loc.zipCode ? ` (${loc.zipCode})` : ''}</div>
                    </td>
                    <td>
                      {c.provider?.intermediaryCard?.title && (
                        <div className="td-agency">{c.provider.intermediaryCard.title}</div>
                      )}
                      {c.provider?.rating?.rating != null && (
                        <div className="td-rating">⭐ {Number(c.provider.rating.rating).toFixed(1)}</div>
                      )}
                    </td>
                    <td>
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="view-link">Voir →</a>
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
