import { fmtDate, fmtPrice } from '../utils/formatters';
import { InfoEmpty, InfoPanelShell, InfoStatGrid, PrimitiveEntries } from './InfoPanelShell';

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function readMedianIndicator(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const candidates = [
    entry.prix_median,
    entry.prix_median_m2,
    entry.prix_m2_median,
    entry.mediane_prix,
    entry.mediane_prix_m2,
    entry.median_price,
  ];
  for (const candidate of candidates) {
    const number = Number(candidate);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function prettyLabel(key) {
  return String(key || '').replace(/_/g, ' ');
}

export default function DvfPlusPanel({ snapshot, marketIndicators }) {
  const features = snapshot?.data?.features || [];
  const sales = features
    .map((feature) => feature?.properties || {})
    .filter((item) => item.updated_price && item.area);
  const ppm2Values = sales.map((item) => item.updated_price / item.area).filter(Number.isFinite);
  const latestIndicator = marketIndicators?.results?.[marketIndicators.results.length - 1] || null;
  const latestEntries = latestIndicator
    ? Object.entries(latestIndicator).filter(([, value]) => value != null && typeof value !== 'object').slice(0, 10)
    : [];

  if (!features.length && !marketIndicators?.results?.length) {
    return (
      <InfoEmpty
        title="DVF+ indisponible"
        body="Aucune transaction supplementaire ni indicateur communal n'a ete collecte pour ce dossier."
      />
    );
  }

  return (
    <InfoPanelShell
      title="DVF+"
      subtitle="Transactions directes et indicateurs communaux issus du flux DVF enrichi."
    >
      <InfoStatGrid
        items={[
          { label: 'Mutations', value: sales.length || features.length },
          { label: 'Mediane EUR/m2', value: ppm2Values.length ? Math.round(median(ppm2Values)) : null },
          { label: 'Prix median indicateur', value: latestIndicator ? fmtPrice(readMedianIndicator(latestIndicator)) : null },
          { label: 'Serie communale', value: marketIndicators?.results?.length || null, note: 'periodes disponibles' },
        ]}
      />

      {latestEntries.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Dernier point de marche</strong>
          </div>
          <PrimitiveEntries entries={latestEntries.map(([key, value]) => [prettyLabel(key), value])} />
        </div>
      ) : null}

      {sales.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Dernieres mutations</strong>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Adresse</th>
                  <th>Surface</th>
                  <th>Prix</th>
                  <th>EUR/m2</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 20).map((item, index) => (
                  <tr key={`${item.address_name || 'sale'}_${index}`}>
                    <td>{fmtDate(item.sale_at)}</td>
                    <td>{item.address_name || '—'}</td>
                    <td>{item.area ? `${Math.round(item.area)} m2` : '—'}</td>
                    <td>{fmtPrice(item.updated_price)}</td>
                    <td>{item.area ? Math.round(item.updated_price / item.area).toLocaleString('fr-FR') : '—'}</td>
                    <td>{item.item_type || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </InfoPanelShell>
  );
}
