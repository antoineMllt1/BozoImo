import { fmtPrice } from '../utils/formatters';
import { InfoEmpty, InfoPanelShell, InfoStatGrid } from './InfoPanelShell';

function formatDateish(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('fr-FR');
}

export default function CastorusPanel({
  priceHistory,
  listingUrl,
  onRefresh,
  loading = false,
  error = '',
}) {
  if (!listingUrl && !priceHistory) {
    return (
      <InfoEmpty
        title="Castorus indisponible"
        body="Aucune annonce SeLoger exploitable n'a ete trouvee pour lancer la recherche Castorus."
      />
    );
  }

  const actions = onRefresh ? (
    <button className="topbar-btn" onClick={onRefresh} disabled={loading}>
      {loading ? 'Recherche...' : 'Relancer Castorus'}
    </button>
  ) : null;

  if (loading && !priceHistory) {
    return (
      <InfoPanelShell title="Castorus" subtitle="Historique de prix et pression vendeuse." actions={actions}>
        <div className="info-empty">
          <strong>Recherche en cours</strong>
          <p>Le moteur Castorus est en train d'analyser l'annonce cible.</p>
        </div>
      </InfoPanelShell>
    );
  }

  if (!priceHistory || priceHistory.error) {
    return (
      <InfoPanelShell title="Castorus" subtitle="Historique de prix et pression vendeuse." actions={actions}>
        <div className="info-inline-error">{error || priceHistory?.error || 'Castorus n a pas encore renvoye de donnees.'}</div>
      </InfoPanelShell>
    );
  }

  if (!priceHistory.found) {
    return (
      <InfoPanelShell title="Castorus" subtitle="Historique de prix et pression vendeuse." actions={actions}>
        <InfoEmpty
          title="Annonce non retrouvee"
          body="Castorus n'a pas retrouve d'historique exploitable pour cette annonce."
        />
      </InfoPanelShell>
    );
  }

  return (
    <InfoPanelShell
      title="Castorus"
      subtitle="Historique de prix, temps en ligne et signaux de souplesse vendeur."
      actions={actions}
    >
      <InfoStatGrid
        items={[
          { label: 'Jours en vente', value: priceHistory.daysOnMarket },
          { label: 'Variation totale', value: priceHistory.totalPriceChange != null ? `${priceHistory.totalPriceChange}%` : null },
          { label: 'Prix actuel', value: fmtPrice(priceHistory.currentPrice) },
          { label: 'Vs marche', value: priceHistory.priceVsMarket != null ? `${priceHistory.priceVsMarket}%` : null, note: priceHistory.negotiationPotential || '' },
        ]}
      />

      {error ? <div className="info-inline-error">{error}</div> : null}

      {(priceHistory.listingUrl || listingUrl) ? (
        <div className="info-link-row">
          <a href={priceHistory.listingUrl || listingUrl} target="_blank" rel="noopener noreferrer">Ouvrir l'annonce source</a>
        </div>
      ) : null}

      {priceHistory.priceChanges?.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Historique des baisses</strong>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ancien prix</th>
                  <th>Nouveau prix</th>
                  <th>Variation</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.priceChanges.map((item, index) => (
                  <tr key={`change_${index}`}>
                    <td>{formatDateish(item.date)}</td>
                    <td>{fmtPrice(item.oldPrice)}</td>
                    <td>{fmtPrice(item.newPrice)}</td>
                    <td>{item.changePct != null ? `${item.changePct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {priceHistory.agencies?.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Agences detectees</strong>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agence</th>
                  <th>Prix</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.agencies.map((item, index) => (
                  <tr key={`agency_${index}`}>
                    <td>{item.name || '—'}</td>
                    <td>{fmtPrice(item.price)}</td>
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
