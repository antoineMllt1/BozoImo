function renderValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('fr-FR');
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  return String(value);
}

export function InfoPanelShell({ title, subtitle = '', actions = null, children }) {
  return (
    <div className="info-panel">
      <div className="info-panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="info-panel-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function InfoStatGrid({ items = [] }) {
  const filtered = items.filter((item) => item && ((item.value != null && item.value !== '—') || item.note));
  if (!filtered.length) return null;

  return (
    <div className="info-stat-grid">
      {filtered.map((item) => (
        <div key={item.label} className="info-stat-card">
          <span>{item.label}</span>
          <strong>{renderValue(item.value)}</strong>
          {item.note ? <small>{item.note}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function InfoEmpty({ title, body, action = null }) {
  return (
    <div className="info-empty">
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function PrimitiveEntries({ entries = [] }) {
  const rows = entries.filter(([, value]) => value != null && value !== '' && typeof value !== 'object');
  if (!rows.length) return null;

  return (
    <div className="info-kv-grid">
      {rows.map(([label, value]) => (
        <div key={label} className="info-kv-row">
          <span>{label}</span>
          <strong>{renderValue(value)}</strong>
        </div>
      ))}
    </div>
  );
}
