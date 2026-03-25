export const fmtK = v => {
  const n = Number(v);
  if (!n) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M €`;
  if (n >= 1e3) return `${Math.round(n / 1000)}k €`;
  return `${Math.round(n)} €`;
};

export const fmtPm2 = v =>
  v ? `${Math.round(v).toLocaleString('fr-FR')} €/m²` : '—';

export const fmtPrice = v => {
  const n = Number(v);
  if (!n) return '—';
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
};

export const fmtDate = s => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return s;
  }
};

export const isoToday = () => new Date().toISOString().slice(0, 10);

export const extractKf = (kf, kw) =>
  kf.find(f => f.includes(kw))?.replace(new RegExp(` ?${kw}s?`), '') || '';
