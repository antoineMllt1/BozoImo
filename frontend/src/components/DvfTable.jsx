import { isoToday } from '../utils/formatters';

function dl(content, mime, name) {
  const b = new Blob(['\uFEFF' + content], { type: mime + ';charset=utf-8;' });
  const u = URL.createObjectURL(b);
  const a = Object.assign(document.createElement('a'), { href: u, download: name, style: 'display:none' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
}

export default function DvfTable({
  snapshot,
  selectedComps,
  onToggle,
  hoveredRefId = null,
  onHoverRef = null,
}) {
  if (!snapshot) return (
    <div className="snap-placeholder"><p>Données DVF non disponibles.</p></div>
  );
  if (snapshot.error) return (
    <div className="snap-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>Erreur : {snapshot.error}</span>
    </div>
  );

  const features = snapshot.data?.features || [];
  const nSelected = selectedComps.length;

  const exportData = (fmt) => {
    const sep = fmt === 'csv' ? ',' : '\t';
    const q   = v => fmt === 'csv' && typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    const H   = ['Sélectionné','#','Adresse','Pièces','Surface m²','Prix','Prix actualisé','€/m²','Date'];
    const rows = features.map((f, i) => {
      const p = f.properties;
      return [selectedComps.includes(i)?'✓':'',i+1,q(p.address_name),p.room_count,p.area,q(p.price),p.updated_price,Math.round(p.updated_price/p.area),p.sale_at].join(sep);
    });
    dl([H.join(sep), ...rows].join('\n'),
      fmt==='csv'?'text/csv':'application/vnd.ms-excel',
      `dvf_${isoToday()}.${fmt==='csv'?'csv':'xls'}`);
  };

  return (
    <div className="snap-section">
      <div className="snap-head">
        <div className="snap-meta">
          <span className="snap-count">{features.length}</span>
          <span className="snap-unit"> transaction{features.length > 1 ? 's' : ''}</span>
          {nSelected > 0 && (
            <span className="snap-sel"> · {nSelected} sélectionnée{nSelected > 1 ? 's' : ''} pour l&apos;estimation</span>
          )}
          {nSelected === 0 && features.length > 0 && (
            <span className="snap-hint"> · toutes utilisées pour l&apos;estimation</span>
          )}
        </div>
        <div className="snap-actions">
          {nSelected > 0 && (
            <button className="exp-btn exp-btn-ghost" onClick={() => features.forEach((_, i) => selectedComps.includes(i) && onToggle(i))}>
              Tout décocher
            </button>
          )}
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

      {features.length === 0 ? (
        <div className="empty-state">
          <span>📊</span><p>Aucune transaction DVF dans cette zone.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="td-check">
                  <input
                    type="checkbox"
                    title="Tout sélectionner / déselectionner"
                    checked={nSelected === features.length}
                    onChange={() => {
                      if (nSelected === features.length) {
                        features.forEach((_, i) => onToggle(i));
                      } else {
                        features.forEach((_, i) => { if (!selectedComps.includes(i)) onToggle(i); });
                      }
                    }}
                  />
                </th>
                <th>#</th><th>Adresse</th><th>Pièces</th><th>Surface m²</th>
                <th>Prix origine</th><th>Prix actualisé</th><th>€/m²</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feat, i) => {
                const p        = feat.properties;
                const isOn     = selectedComps.includes(i);
                const refId    = `dvf_${i}`;
                const pm2      = p.area > 0 ? Math.round(p.updated_price / p.area) : null;
                return (
                  <tr
                    key={p.id || i}
                    className={`${isOn ? 'dvf-row-on' : ''} ${hoveredRefId === refId ? 'ref-hovered' : ''}`.trim()}
                    onClick={() => onToggle(i)}
                    onMouseEnter={() => onHoverRef?.(refId)}
                    onMouseLeave={() => onHoverRef?.(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="td-check" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isOn} onChange={() => onToggle(i)} />
                    </td>
                    <td className="td-n">{i + 1}</td>
                    <td className="td-addr">{p.address_name}</td>
                    <td className="td-c">{p.room_count ?? '—'}</td>
                    <td className="td-c">{p.area}</td>
                    <td>{p.price}</td>
                    <td className="td-price">{p.updated_price?.toLocaleString('fr-FR')} €</td>
                    <td className="td-ppm">{pm2?.toLocaleString('fr-FR')}</td>
                    <td className="td-date">{p.sale_at}</td>
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
