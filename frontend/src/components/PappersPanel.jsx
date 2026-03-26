import { fmtDate, fmtPrice } from '../utils/formatters';
import { InfoEmpty, InfoPanelShell, InfoStatGrid, PrimitiveEntries } from './InfoPanelShell';

export default function PappersPanel({ snapshot, onLoadDetail, loading = false, error = '' }) {
  const parcelles = snapshot?.parcelles || [];
  const detail = snapshot?.detail || null;
  const firstParcelle = parcelles[0] || null;
  const canLoadDetail = snapshot?.canLoadDetail !== false;

  if (!parcelles.length && !detail) {
    return (
      <InfoEmpty
        title="Pappers indisponible"
        body="Aucune parcelle ni detail de parcelle n'a ete collecte pour ce dossier."
      />
    );
  }

  return (
    <InfoPanelShell
      title="Pappers Immobilier"
      subtitle="Parcelles proches, ventes rattachees, batiments et contextes d'urbanisme."
      actions={
        firstParcelle && onLoadDetail && canLoadDetail ? (
          <button className="topbar-btn" onClick={onLoadDetail} disabled={loading}>
            {loading ? 'Chargement...' : 'Charger le detail'}
          </button>
        ) : null
      }
    >
      <InfoStatGrid
        items={[
          { label: 'Parcelles', value: parcelles.length },
          { label: 'Ventes', value: detail?.ventes?.length || null },
          { label: 'Batiments', value: detail?.batiments?.length || null },
          { label: 'DPE rattaches', value: detail?.dpe?.length || null },
        ]}
      />

      {snapshot?.warning ? <div className="info-inline-error">{snapshot.warning}</div> : null}
      {error ? <div className="info-inline-error">{error}</div> : null}

      {parcelles.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Parcelles trouvees</strong>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Section</th>
                  <th>Contenance</th>
                  <th>Adresse</th>
                </tr>
              </thead>
              <tbody>
                {parcelles.map((item, index) => (
                  <tr key={`${item.numero || 'parcel'}_${index}`}>
                    <td>{item.numero || '—'}</td>
                    <td>{item.section || '—'}</td>
                    <td>{item.contenance ? `${Number(item.contenance).toLocaleString('fr-FR')} m2` : '—'}</td>
                    <td>{item.adresse || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="info-grid-2">
          {detail.copropriete ? (
            <div className="info-section">
              <div className="info-section-head">
                <strong>Copropriete</strong>
              </div>
              <PrimitiveEntries entries={Object.entries(detail.copropriete).slice(0, 10)} />
            </div>
          ) : null}

          {detail.urbanisme ? (
            <div className="info-section">
              <div className="info-section-head">
                <strong>Urbanisme</strong>
              </div>
              <PrimitiveEntries entries={Object.entries(detail.urbanisme).slice(0, 10)} />
            </div>
          ) : null}
        </div>
      ) : null}

      {detail?.ventes?.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Ventes rattachees</strong>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Adresse</th>
                  <th>Prix</th>
                </tr>
              </thead>
              <tbody>
                {detail.ventes.slice(0, 12).map((item, index) => (
                  <tr key={`vente_${index}`}>
                    <td>{fmtDate(item.date_mutation || item.date)}</td>
                    <td>{item.adresse || item.adresse_complete || '—'}</td>
                    <td>{fmtPrice(item.valeur_fonciere || item.prix || item.price)}</td>
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
